// Saves a study reviewer to the logged-in user's "Saved" list, or removes it.
// props: reviewerId, title, isSaved
//        onChange   optional. Called with { isSaved, savedId } after each change.
import { useContext, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { saveReviewer, unsaveReviewer } from '../services/reviewersService';
import { updateRememberedSave } from '../services/feedMemory';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';

function SaveButton(props) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [isSaved, setIsSaved] = useState(props.isSaved);
  const [isWorking, setIsWorking] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');

  // Sends the change to the server and keeps every copy of the list in step.
  const changeSaved = async (shouldSave) => {
    setIsWorking(true);
    setError('');
    try {
      let result;
      if (shouldSave) {
        result = await saveReviewer(props.reviewerId);
        setAnnouncement('Saved. Find it under Saved in the menu.');
      } else {
        result = await unsaveReviewer(props.reviewerId);
        setAnnouncement('Removed from your saved study reviewers.');
      }
      setIsSaved(result.isSaved);
      updateRememberedSave(props.reviewerId, result.isSaved, result.savedId);
      setIsConfirmOpen(false);
      if (props.onChange) {
        props.onChange(result);
      }
    } catch (err) {
      setError(err.message);
      setIsConfirmOpen(false);
    }
    setIsWorking(false);
  };

  const handleClick = () => {
    if (isWorking) {
      return;
    }

    if (!auth.firebaseUser) {
      navigate('/login', {
        state: { from: location.pathname, message: 'Log in to save study reviewers.' },
      });
      return;
    }

    // Unsaving also deletes the notes and flashcards made for it, so ask first.
    if (isSaved) {
      setIsConfirmOpen(true);
    } else {
      changeSaved(true);
    }
  };

  let visibleText = 'Save';
  if (isSaved) {
    visibleText = 'Saved';
  }

  return (
    <>
      <button
        type="button"
        className="save"
        aria-pressed={isSaved}
        aria-label={`${visibleText} ${props.title} study reviewer`}
        aria-disabled={isWorking}
        onClick={handleClick}
      >
        <Icon name="bookmark" filled={isSaved} />
        <span>{visibleText}</span>
      </button>
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
      {error !== '' && (
        <p className="upvote-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        id={`unsave-dialog-${props.reviewerId}`}
        isOpen={isConfirmOpen}
        title="Remove from Saved?"
        message={`Your notes and flashcards for “${props.title}” will be deleted too. This cannot be undone.`}
        confirmLabel="Remove"
        isBusy={isWorking}
        error=""
        onConfirm={() => changeSaved(false)}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}

export default SaveButton;
