// Flashcards for one saved study reviewer: make a set with AI, then study it.
// How well you know each card (not studied, learning, learned) is saved to your
// account, so your progress is still there next time and on other devices.
//
// props:
//   savedId   id of the saved item
//   title     the study reviewer's title
//   canMake   false when the original file was removed, so no new set can be made
import { useEffect, useState } from 'react';
import {
  createFlashcards,
  deleteFlashcards,
  listFlashcards,
  setFlashcardStatus,
} from '../services/savedService';
import Alert from './Alert';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import Flashcard from './Flashcard';
import FormField from './FormField';
import Icon from './Icon';
import Spinner from './Spinner';

// Keep the same as LIMITS.flashcardsMin / flashcardsMax in backend/src/utils/validate.js.
const COUNT_MIN = 5;
const COUNT_MAX = 100;

const STATUS_TILES = [
  { status: 'new', label: 'Not studied' },
  { status: 'learning', label: 'Learning' },
  { status: 'learned', label: 'Learned' },
];

// A new list with the same ids in a random order (the Fisher-Yates shuffle).
const shuffleIds = (ids) => {
  const shuffled = ids.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const held = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = held;
  }
  return shuffled;
};

const idsInOrder = (cards) => {
  return cards.map((card) => card.id);
};

// Keyboard shortcuts must not fire while someone is typing or using a menu.
const isTypingTarget = (element) => {
  const tagName = element.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

function FlashcardsPanel(props) {
  const [cards, setCards] = useState([]);
  // status is 'loading', 'ready', or 'error'.
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Making a set.
  const [count, setCount] = useState('20');
  const [isMaking, setIsMaking] = useState(false);
  const [makeError, setMakeError] = useState('');
  const [countError, setCountError] = useState('');
  // Shown when the material was too short for the number of cards asked for.
  const [fewerNote, setFewerNote] = useState('');
  const [isRemakeOpen, setIsRemakeOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Studying.
  const [order, setOrder] = useState([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [onlyUnlearned, setOnlyUnlearned] = useState(false);
  const [position, setPosition] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [statusError, setStatusError] = useState('');

  // Starts studying a (new) set from the first card.
  const startStudying = (newCards) => {
    setCards(newCards);
    setOrder(idsInOrder(newCards));
    setIsShuffled(false);
    setOnlyUnlearned(false);
    setPosition(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    let isCancelled = false;

    const loadCards = async () => {
      setStatus('loading');
      try {
        const data = await listFlashcards(props.savedId);
        if (!isCancelled) {
          startStudying(data.cards);
          setStatus('ready');
        }
      } catch (err) {
        if (!isCancelled) {
          setLoadError(err.message);
          setStatus('error');
        }
      }
    };

    loadCards();

    return () => {
      isCancelled = true;
    };
  }, [props.savedId, retryCount]);

  // The cards being studied right now, in study order.
  const studyCards = order
    .map((id) => cards.find((card) => card.id === id))
    .filter((card) => {
      if (!card) {
        return false;
      }
      return !onlyUnlearned || card.status !== 'learned';
    });

  let currentIndex = position;
  if (currentIndex > studyCards.length - 1) {
    currentIndex = Math.max(studyCards.length - 1, 0);
  }
  const currentCard = studyCards[currentIndex] || null;

  const goTo = (nextIndex) => {
    if (nextIndex < 0 || nextIndex > studyCards.length - 1) {
      return;
    }
    setPosition(nextIndex);
    setIsFlipped(false);
    setAnnouncement(`Card ${nextIndex + 1} of ${studyCards.length}. Question: ${studyCards[nextIndex].front}`);
  };

  const flipCard = () => {
    if (!currentCard) {
      return;
    }
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (nextFlipped) {
      setAnnouncement(`Answer: ${currentCard.back}`);
    } else {
      setAnnouncement(`Question: ${currentCard.front}`);
    }
  };

  // Left and right arrow keys move between cards while this panel is open.
  useEffect(() => {
    const handleKeyDown = (event) => {
      // The tabs above use the arrow keys too; they mark the key as handled.
      if (event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }
      if (document.querySelector('dialog[open]')) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex - 1);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  const markCard = async (newStatus) => {
    if (!currentCard) {
      return;
    }
    setStatusError('');
    try {
      const updated = await setFlashcardStatus(props.savedId, currentCard.id, newStatus);
      setCards(
        cards.map((card) => {
          if (card.id === updated.id) {
            return updated;
          }
          return card;
        })
      );
      // With "not learned yet" on, a learned card leaves the list and the next
      // one slides into its place, so the position stays the same.
      const leavesList = onlyUnlearned && newStatus === 'learned';
      if (!leavesList && currentIndex < studyCards.length - 1) {
        goTo(currentIndex + 1);
      } else {
        setIsFlipped(false);
        if (currentIndex >= studyCards.length - 1 && !leavesList) {
          setAnnouncement('That was the last card. Use Previous to go back, or shuffle and go again.');
        } else {
          setAnnouncement('Marked as learned.');
        }
      }
    } catch (err) {
      setStatusError(err.message);
    }
  };

  const handleShuffleToggle = () => {
    if (isShuffled) {
      setOrder(idsInOrder(cards));
      setAnnouncement('Cards are back in their original order.');
    } else {
      setOrder(shuffleIds(idsInOrder(cards)));
      setAnnouncement('Cards shuffled.');
    }
    setIsShuffled(!isShuffled);
    setPosition(0);
    setIsFlipped(false);
  };

  const handleFilterToggle = () => {
    setOnlyUnlearned(!onlyUnlearned);
    setPosition(0);
    setIsFlipped(false);
  };

  const makeCards = async () => {
    if (isMaking) {
      return;
    }
    setIsMaking(true);
    setMakeError('');
    setFewerNote('');
    try {
      const asked = Number(count);
      const data = await createFlashcards(props.savedId, asked);
      startStudying(data.cards);
      setIsRemakeOpen(false);
      setAnnouncement(`${data.cards.length} flashcards are ready.`);
      // Short material gives fewer cards on purpose, rather than repeats or filler.
      if (data.cards.length < asked) {
        setFewerNote(
          `Made ${data.cards.length} cards. The material had enough for ${data.cards.length} good ones, not ${asked}.`
        );
      }
    } catch (err) {
      setMakeError(err.message);
      setIsRemakeOpen(false);
    }
    setIsMaking(false);
  };

  // The number box must hold a whole number from 5 to 100.
  const hasCount = () => {
    const number = Number(count);
    if (count.trim() === '' || !Number.isInteger(number) || number < COUNT_MIN || number > COUNT_MAX) {
      setCountError(`Enter a whole number from ${COUNT_MIN} to ${COUNT_MAX}.`);
      const box = document.getElementById('flashcard-count');
      if (box) {
        box.focus();
      }
      return false;
    }
    setCountError('');
    return true;
  };

  const handleMakeSubmit = (event) => {
    event.preventDefault();
    if (hasCount()) {
      makeCards();
    }
  };

  // Replacing a set loses the progress on it, so this asks first.
  const handleRemakeSubmit = (event) => {
    event.preventDefault();
    if (!isMaking && hasCount()) {
      setMakeError('');
      setIsRemakeOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteFlashcards(props.savedId);
      startStudying([]);
      setIsDeleteOpen(false);
      setAnnouncement('Flashcards deleted.');
      // The Delete button is gone now, so move focus to the panel heading.
      const heading = document.getElementById('flashcards-heading');
      if (heading) {
        heading.focus();
      }
    } catch (err) {
      setDeleteError(err.message);
    }
    setIsDeleting(false);
  };

  const countFor = (cardStatus) => {
    return cards.filter((card) => card.status === cardStatus).length;
  };

  let makeButtonText = 'Make flashcards';
  if (isMaking) {
    makeButtonText = 'Making flashcards…';
  }

  const countField = (
    <FormField
      id="flashcard-count"
      label="Number of cards"
      type="number"
      value={count}
      onChange={(event) => setCount(event.target.value)}
      min={COUNT_MIN}
      max={COUNT_MAX}
      step={1}
      inputMode="numeric"
      hint={`From ${COUNT_MIN} to ${COUNT_MAX}. The size of the material sets how many good cards it can give: about 1 card for every 50 to 100 words works well. If it is too short for your number, you get fewer cards instead of filler.`}
      error={countError}
    />
  );

  return (
    <section className="flash-panel" aria-labelledby="flashcards-heading">
      <h2 id="flashcards-heading" className="section-title" tabIndex="-1">
        Flashcards
      </h2>

      {/* Everything the panel says out loud (card changes, flips, results). */}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      {status === 'loading' && <Spinner label="Loading flashcards…" />}

      {status === 'error' && (
        <div className="stack">
          <Alert type="error">{loadError}</Alert>
          <div>
            <button type="button" className="button" onClick={() => setRetryCount(retryCount + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && cards.length === 0 && !props.canMake && (
        <EmptyState
          icon="cards"
          title="No flashcards"
          message="The original file was removed, so flashcards can no longer be made from it."
        />
      )}

      {status === 'ready' && cards.length === 0 && props.canMake && (
        <div className="flash-start">
          <Icon name="cards" large />
          <p className="empty-title">Turn this study reviewer into flashcards</p>
          <p className="muted">
            AI (Google Gemini) reads the file and writes question-and-answer cards from it. Check
            them as you study: AI can make mistakes. Only you can see your flashcards.
          </p>

          <form className="start-form" onSubmit={handleMakeSubmit} noValidate>
            {countField}
            <button type="submit" className="button-green" aria-disabled={isMaking}>
              <Icon name="cards" />
              {makeButtonText}
            </button>
          </form>

          {isMaking && <Spinner label="Making flashcards. This can take up to two minutes…" />}
          {makeError !== '' && <Alert type="error">{makeError}</Alert>}
        </div>
      )}

      {status === 'ready' && cards.length > 0 && (
        <div className="stack">
          {fewerNote !== '' && <Alert type="info">{fewerNote}</Alert>}
          <ul className="tiles" aria-label="Your progress">
            {STATUS_TILES.map((tile) => (
              <li key={tile.status} className={`tile ${tile.status}`}>
                <span className="tile-count">{countFor(tile.status)}</span>
                <span className="tile-label">{tile.label}</span>
              </li>
            ))}
          </ul>

          <div className="flash-options">
            <button
              type="button"
              className="button"
              aria-pressed={isShuffled}
              onClick={handleShuffleToggle}
            >
              <Icon name="shuffle" />
              Shuffle
            </button>
            <button
              type="button"
              className="button"
              aria-pressed={onlyUnlearned}
              onClick={handleFilterToggle}
            >
              <Icon name="check" />
              Only cards not learned yet
            </button>
          </div>

          {!currentCard && (
            <EmptyState
              icon="check"
              title="You have learned every card"
              message="Turn off “Only cards not learned yet” to go through them all again."
            />
          )}

          {currentCard && (
            <div className="flash-study">
              <p className="study-position">
                Card {currentIndex + 1} of {studyCards.length}
              </p>
              <progress
                className="study-progress"
                max={studyCards.length}
                value={currentIndex + 1}
                aria-label="Position in the set"
              >
                {currentIndex + 1} of {studyCards.length}
              </progress>

              {/* The key gives every card its own element, so moving on shows the
                  next question straight away instead of turning the old card back
                  over (which would flash the next card's answer). */}
              <Flashcard
                key={currentCard.id}
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={flipCard}
              />

              <div className="study-nav">
                <button
                  type="button"
                  className="button"
                  aria-disabled={currentIndex === 0}
                  onClick={() => goTo(currentIndex - 1)}
                >
                  <Icon name="arrow-left" />
                  Previous
                </button>
                <button
                  type="button"
                  className="button"
                  aria-disabled={currentIndex >= studyCards.length - 1}
                  onClick={() => goTo(currentIndex + 1)}
                >
                  Next
                  <Icon name="arrow-right" />
                </button>
              </div>

              <div className="study-rate">
                <button type="button" className="button" onClick={() => markCard('learning')}>
                  Still learning
                </button>
                <button
                  type="button"
                  className="button-green"
                  onClick={() => markCard('learned')}
                >
                  <Icon name="check" />
                  Got it
                </button>
              </div>
              {statusError !== '' && <Alert type="error">{statusError}</Alert>}

              <p className="hint">
                Keyboard: Space or Enter turns the card over, Left and Right arrows move between
                cards.
              </p>
            </div>
          )}

          <div className="flash-manage">
            <h3>Manage this set</h3>
            {props.canMake && (
              <form className="start-form" onSubmit={handleRemakeSubmit} noValidate>
                {countField}
                <button type="submit" className="button" aria-disabled={isMaking}>
                  <Icon name="flip" />
                  Make a new set
                </button>
              </form>
            )}
            {isMaking && <Spinner label="Making flashcards. This can take up to two minutes…" />}
            {makeError !== '' && <Alert type="error">{makeError}</Alert>}
            <div>
              <button
                type="button"
                className="button-outline"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Icon name="trash" />
                Delete flashcards
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        id="remake-flashcards-dialog"
        isOpen={isRemakeOpen}
        title="Make a new set?"
        message={`Your ${cards.length} current flashcards and your progress on them will be replaced by ${count} new ones.`}
        confirmLabel="Make new set"
        isBusy={isMaking}
        error=""
        onConfirm={makeCards}
        onCancel={() => setIsRemakeOpen(false)}
      />

      <ConfirmDialog
        id="delete-flashcards-dialog"
        isOpen={isDeleteOpen}
        title="Delete these flashcards?"
        message={`All ${cards.length} flashcards for “${props.title}” and your progress on them will be deleted.`}
        confirmLabel="Delete"
        isBusy={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </section>
  );
}

export default FlashcardsPanel;
