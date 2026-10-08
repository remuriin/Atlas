// Create a new account.
import { useContext, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { describeAuthError, register } from '../services/authService';
import Alert from '../components/Alert';
import ErrorSummary from '../components/ErrorSummary';
import FormField from '../components/FormField';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';

const FIELD_ORDER = ['displayName', 'email', 'password', 'confirmPassword'];

const NAME_MIN = 2;
const NAME_MAX = 50;
const PASSWORD_MIN = 8;

const looksLikeEmail = (value) => {
  return /^\S+@\S+\.\S+$/.test(value);
};

function RegisterPage() {
  const auth = useContext(AuthContext);
  const location = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  let returnPath = '/';
  if (location.state && location.state.from) {
    returnPath = location.state.from;
  }

  const showErrors = (found) => {
    setErrors(found);
    const firstField = FIELD_ORDER.find((name) => found[name]);
    if (firstField) {
      const input = document.getElementById(`register-${firstField}`);
      if (input) {
        input.focus();
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setSubmitError('');

    const cleanName = displayName.trim();
    const cleanEmail = email.trim();
    const found = {};

    if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
      found.displayName = `Enter a display name between ${NAME_MIN} and ${NAME_MAX} characters.`;
    }
    if (!looksLikeEmail(cleanEmail)) {
      found.email = 'Enter an email address, like name@example.com.';
    }
    if (password.length < PASSWORD_MIN) {
      found.password = `Enter a password with at least ${PASSWORD_MIN} characters.`;
    }
    if (confirmPassword !== password || confirmPassword === '') {
      found.confirmPassword = 'Type the same password again. The two do not match yet.';
    }
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      const profile = await register(cleanName, cleanEmail, password);
      // Put the saved profile (with the chosen display name) into the app straight away.
      auth.setProfile(profile);
    } catch (err) {
      setSubmitError(describeAuthError(err));
      setIsSubmitting(false);
    }
  };

  if (auth.isLoading) {
    return <Spinner label="Checking your login…" />;
  }

  // The account exists as soon as Firebase confirms it, so move on.
  if (auth.firebaseUser) {
    return <Navigate to={returnPath} replace />;
  }

  const summaryErrors = FIELD_ORDER.filter((name) => errors[name]).map((name) => {
    return { fieldId: `register-${name}`, message: errors[name] };
  });

  let submitText = 'Create account';
  if (isSubmitting) {
    submitText = 'Creating account…';
  }

  return (
    <div className="page-form">
      <PageHeading title="Create an account" />
      <p className="page-intro">
        An account lets you upvote and share study reviewers. Browsing is always free and open.
      </p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <ErrorSummary errors={summaryErrors} />
        {submitError !== '' && <Alert type="error">{submitError}</Alert>}

        <FormField
          id="register-displayName"
          label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          maxLength={NAME_MAX}
          autoComplete="nickname"
          hint="Shown next to the study reviewers you share."
          error={errors.displayName}
        />

        <FormField
          id="register-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          hint="Only you can see this. It is used to log in and to reset your password."
          error={errors.email}
        />

        <FormField
          id="register-password"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={errors.password}
        />

        <FormField
          id="register-confirmPassword"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <div className="form__actions">
          <button type="submit" className="button button--primary" aria-disabled={isSubmitting}>
            {submitText}
          </button>
        </div>

        <p className="form__footer">
          Already have an account?{' '}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
