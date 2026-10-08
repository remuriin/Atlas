// Wraps pages that need a logged-in user (upload, edit, profile).
// Visitors are sent to the login page, which brings them back here afterwards.
import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Spinner from './Spinner';

function ProtectedRoute(props) {
  const auth = useContext(AuthContext);
  const location = useLocation();

  // On a page reload Firebase needs a moment to restore the session.
  // Wait for it, or logged-in people would be bounced to the login page.
  if (auth.isLoading) {
    return <Spinner label="Checking your login…" />;
  }

  if (!auth.firebaseUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, message: 'Log in to continue.' }}
      />
    );
  }

  return props.children;
}

export default ProtectedRoute;
