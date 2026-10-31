// One flashcard that turns over when pressed: question on the front, answer on
// the back. It is a single real button, so Space and Enter turn it too.
// Only the side facing up is read by screen readers; the other is hidden from them.
//
// props: card, isFlipped, onFlip
import Icon from './Icon';

function Flashcard(props) {
  let className = 'flashcard';
  let actionText = 'Show answer';
  if (props.isFlipped) {
    className = 'flashcard-flipped';
    actionText = 'Show question';
  }

  return (
    <button type="button" className={className} onClick={props.onFlip}>
      <span className="flash-inner">
        <span className="face-front" aria-hidden={props.isFlipped}>
          <span className="flash-side">Question</span>
          <span className="flash-text">{props.card.front}</span>
        </span>
        <span className="face-back" aria-hidden={!props.isFlipped}>
          <span className="flash-side">Answer</span>
          <span className="flash-text">{props.card.back}</span>
        </span>
      </span>
      <span className="flip-hint">
        <Icon name="flip" />
        {actionText}
      </span>
    </button>
  );
}

export default Flashcard;
