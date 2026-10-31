// A message box for errors, successes, and notes.
// props:
//   type        'error', 'success', or 'info'. The message goes between the tags.
//   onDismiss   optional. When given, a close button is shown and this is
//               called when it is pressed.
import Icon from './Icon';

function Alert(props) {
  // Each type has its own icon and a word in front, so the meaning
  // never depends on the color alone.
  let iconName = 'info';
  let title = 'Note:';
  // role="status" is read out politely when the current sentence finishes.
  let role = 'status';

  if (props.type === 'error') {
    iconName = 'alert';
    title = 'Error:';
    // role="alert" interrupts, which is right for errors only.
    role = 'alert';
  } else if (props.type === 'success') {
    iconName = 'check';
    title = 'Success:';
  }

  return (
    <div className={`alert alert-${props.type}`} role={role}>
      <Icon name={iconName} />
      <div className="alert-body">
        <span className="alert-title">{title}</span> {props.children}
      </div>
      {props.onDismiss && (
        <button
          type="button"
          className="button button-quiet alert-dismiss"
          aria-label="Dismiss message"
          onClick={props.onDismiss}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

export default Alert;
