// The upvote control: the only social feature in LearnHub.
// props: reviewerId, title, count, hasUpvoted
import { useContext, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { addUpvote, removeUpvote } from '../services/reviewersService';
import { countLabel } from '../services/format';
import { updateRememberedUpvote } from '../services/feedMemory';
import Icon from './Icon';

function UpvoteButton(props) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Start from what the server sent, then keep our own copy up to date after each click.
  const [count, setCount] = useState(props.count);
  const [hasUpvoted, setHasUpvoted] = useState(props.hasUpvoted);
  const [isSaving, setIsSaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');

  const handleClick = async () => {
    // Ignore extra clicks while the first one is still being saved.
    if (isSaving) {
      return;
    }

    if (!auth.firebaseUser) {
      // Send visitors to log in, and remember where to bring them back to.
      navigate('/login', {
        state: { from: location.pathname, message: 'Log in to upvote study reviewers.' },
      });
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      let result;
      if (hasUpvoted) {
        result = await removeUpvote(props.reviewerId);
      } else {
        result = await addUpvote(props.reviewerId);
      }
      // Show the count the server just counted, so it is always the true number.
      setCount(result.upvoteCount);
      setHasUpvoted(result.hasUpvoted);
      // If the feed is remembered for the Back button, update its copy too.
      updateRememberedUpvote(props.reviewerId, result.upvoteCount, result.hasUpvoted);

      const newTotal = countLabel(result.upvoteCount, 'upvote', 'upvotes');
      if (result.hasUpvoted) {
        setAnnouncement(`Upvoted. ${newTotal}.`);
      } else {
        setAnnouncement(`Upvote removed. ${newTotal}.`);
      }
    } catch (err) {
      setError(err.message);
    }
    setIsSaving(false);
  };

  let visibleText = 'Upvote';
  if (hasUpvoted) {
    visibleText = 'Upvoted';
  }

  // The name starts with the word shown on the button (so voice control users can
  // say what they see) and adds the title and count, so on a page full of
  // buttons each one says which reviewer it belongs to.
  const total = countLabel(count, 'upvote', 'upvotes');
  const accessibleName = `${visibleText} ${props.title} study reviewer, ${total}`;

  return (
    <>
      <button
        type="button"
        className="button upvote-button"
        aria-pressed={hasUpvoted}
        aria-label={accessibleName}
        aria-disabled={isSaving}
        onClick={handleClick}
      >
        <Icon name="arrow-up" filled={hasUpvoted} />
        <span>{visibleText}</span>
        <span className="upvote-button__count">{count}</span>
      </button>
      {/* Screen readers read this out when it changes, without moving focus. */}
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
      {error !== '' && (
        <p className="upvote-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export default UpvoteButton;
