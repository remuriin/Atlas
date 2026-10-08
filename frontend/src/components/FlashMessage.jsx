// Shows a one-time success message that the previous page handed over,
// for example "Your changes were saved." after the edit form sends you here.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Alert from './Alert';

function FlashMessage() {
  const location = useLocation();
  const navigate = useNavigate();

  let startMessage = '';
  if (location.state && location.state.flash) {
    startMessage = location.state.flash;
  }
  // Keep our own copy, because the handed-over message is erased just below.
  const [message, setMessage] = useState(startMessage);

  // The browser remembers handed-over messages, so without this the same
  // "saved" note would show again after a page reload.
  useEffect(() => {
    if (location.state && location.state.flash) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, []);

  const handleDismiss = () => {
    setMessage('');
    // The close button is about to disappear. Move focus to the page heading
    // so keyboard users are not left with focus on nothing.
    const heading = document.getElementById('page-heading');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  };

  if (message === '') {
    return null;
  }

  return (
    <Alert type="success" onDismiss={handleDismiss}>
      {message}
    </Alert>
  );
}

export default FlashMessage;
