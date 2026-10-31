// Log in. This page has a second view for resetting a forgotten password,
// reached at /login?mode=reset, so the browser's Back button returns to the
// login form.
import { useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  clearReturnPath,
  describeAuthError,
  login,
  readReturnPath,
  sendPasswordReset,
} from '../services/authService';
import Alert from '../components/Alert';
import ErrorSummary from '../components/ErrorSummary';
import FormField from '../components/FormField';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';

const FIELD_ORDER = ['email', 'password'];

// A simple shape check. Firebase does the real check when the form is sent.
const looksLikeEmail = (value) => {
  return /^\S+@\S+\.\S+$/.test(value);
};

function LoginPage() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isResetView = searchParams.get('mode') === 'reset';

  // The email is shared by both views, so it does not have to be typed twice.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The address the reset email was sent to ('' until it has been sent).
  const [resetSentTo, setResetSentTo] = useState('');

  // If another page sent the visitor here, it also said where to go back to.
  let returnPath = '/';
  let reasonMessage = '';
  if (location.state) {
    if (location.state.from) {
      returnPath = location.state.from;
    }
    if (location.state.message) {
      reasonMessage = location.state.message;
    }
  }
  // Coming back from a Google sign-in that left the page (pop-up was blocked).
  const rememberedPath = readReturnPath();
  if (rememberedPath !== '') {
    returnPath = rememberedPath;
  }

  // Once logged in, the remembered path has done its job.
  useEffect(() => {
    if (auth.firebaseUser) {
      clearReturnPath();
    }
  }, [auth.firebaseUser]);

  // Shows the problems and puts the cursor in the first field that has one.
  const showErrors = (found) => {
    setErrors(found);
    const firstField = FIELD_ORDER.find((name) => found[name]);
    if (firstField) {
      const input = document.getElementById(`login-${firstField}`);
      if (input) {
        input.focus();
      }
    }
  };

  // Switches between the login form and the reset form.
  const showView = (mode) => {
    setErrors({});
    setSubmitError('');
    setResetSentTo('');

    const nextParams = {};
    if (mode === 'reset') {
      nextParams.mode = 'reset';
    }
    // Keep "where to go after logging in" while switching views.
    setSearchParams(nextParams, { state: location.state });

    // The heading text is about to change. Focus it once React has updated the
    // page (a zero-length timer runs right after), so screen readers announce
    // the new view instead of leaving focus on a button that has gone.
    window.setTimeout(() => {
      const heading = document.getElementById('page-heading');
      if (heading) {
        heading.focus();
      }
    }, 0);
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setSubmitError('');

    const found = {};
    if (!looksLikeEmail(email.trim())) {
      found.email = 'Enter your email address, like name@example.com.';
    }
    if (password === '') {
      found.password = 'Enter your password.';
    }
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      // Nothing more to do here: once the app sees the login,
      // the <Navigate> below sends the visitor on their way.
    } catch (err) {
      setSubmitError(describeAuthError(err));
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setSubmitError('');
    setResetSentTo('');

    if (!looksLikeEmail(email.trim())) {
      showErrors({ email: 'Enter the email address you signed up with, like name@example.com.' });
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSentTo(email.trim());
    } catch (err) {
      setSubmitError(describeAuthError(err));
    }
    setIsSubmitting(false);
  };

  if (auth.isLoading) {
    return <Spinner label="Checking your login…" />;
  }

  // Already logged in (or just finished logging in): go back to where they came from.
  if (auth.firebaseUser) {
    return <Navigate to={returnPath} replace />;
  }

  const summaryErrors = FIELD_ORDER.filter((name) => errors[name]).map((name) => {
    return { fieldId: `login-${name}`, message: errors[name] };
  });

  if (isResetView) {
    let resetButtonText = 'Email me a reset link';
    if (isSubmitting) {
      resetButtonText = 'Sending…';
    }

    return (
      <div className="page-form">
        <img className="page-form__logo" src="/logo.png" alt="" width="48" height="48" />
        <PageHeading title="Reset your password" />
        <p className="page-intro">
          Enter the email address you signed up with. We will email you a link for choosing a new
          password.
        </p>

        <form className="form" onSubmit={handleResetSubmit} noValidate>
          <ErrorSummary errors={summaryErrors} />
          {submitError !== '' && <Alert type="error">{submitError}</Alert>}
          {resetSentTo !== '' && (
            <Alert type="success">
              If there is an account for {resetSentTo}, a reset email is on its way. Check your
              inbox and your spam folder.
            </Alert>
          )}

          <FormField
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            error={errors.email}
          />

          <div className="form__actions">
            <button type="submit" className="button button--primary" aria-disabled={isSubmitting}>
              {resetButtonText}
            </button>
            <button type="button" className="button" onClick={() => showView('login')}>
              Back to log in
            </button>
          </div>
        </form>
      </div>
    );
  }

  let loginButtonText = 'Log in';
  if (isSubmitting) {
    loginButtonText = 'Logging in…';
  }

  return (
    <div className="page-form">
      <img className="page-form__logo" src="/logo.png" alt="" width="48" height="48" />
      <PageHeading title="Log in" />
      <p className="page-intro">Log in to upvote, share, and manage your study reviewers.</p>

      <form className="form" onSubmit={handleLoginSubmit} noValidate>
        {reasonMessage !== '' && <Alert type="info">{reasonMessage}</Alert>}
        <ErrorSummary errors={summaryErrors} />
        {submitError !== '' && <Alert type="error">{submitError}</Alert>}

        <GoogleSignInButton returnPath={returnPath} onError={setSubmitError} />
        <p className="form-divider">
          <span>or log in with email</span>
        </p>

        <FormField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          error={errors.email}
        />

        <FormField
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          error={errors.password}
        />

        <div className="form__actions">
          <button type="submit" className="button button--primary" aria-disabled={isSubmitting}>
            {loginButtonText}
          </button>
          <button type="button" className="link-button" onClick={() => showView('reset')}>
            Forgot password?
          </button>
        </div>

        <p className="form__footer">
          New to Atlas?{' '}
          <Link to="/register" state={location.state}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
