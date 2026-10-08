// A pop-up that asks "are you sure?" before something that cannot be undone.
//
// It uses the browser's own <dialog> element opened with showModal(). That gives
// correct behaviour for free: focus moves into the dialog and cannot Tab out of it,
// the page behind cannot be clicked or read, Esc closes it, and focus goes back
// to the button that opened it.
//
// props:
//   id             unique id for this dialog
//   isOpen         true to show it
//   title, message
//   confirmLabel   text of the red button, for example "Delete"
//   isBusy         true while the action is running
//   error          message to show if the action failed ('' for none)
//   onConfirm, onCancel
import { useEffect } from 'react';

function ConfirmDialog(props) {
  const titleId = `${props.id}-title`;
  const messageId = `${props.id}-message`;

  // Open or close the real dialog whenever props.isOpen changes.
  useEffect(() => {
    const dialog = document.getElementById(props.id);
    if (!dialog) {
      return;
    }
    if (props.isOpen && !dialog.open) {
      dialog.showModal();
    }
    if (!props.isOpen && dialog.open) {
      dialog.close();
    }
  }, [props.isOpen, props.id]);

  // The browser fires "cancel" when Esc is pressed. We handle closing ourselves
  // so the parent's isOpen value stays the single source of truth.
  const handleCancel = (event) => {
    event.preventDefault();
    if (!props.isBusy) {
      props.onCancel();
    }
  };

  // While the action runs, the buttons stay focusable but do nothing,
  // so a second click cannot start the action twice.
  const handleCancelClick = () => {
    if (!props.isBusy) {
      props.onCancel();
    }
  };

  const handleConfirmClick = () => {
    if (!props.isBusy) {
      props.onConfirm();
    }
  };

  let confirmText = props.confirmLabel;
  if (props.isBusy) {
    confirmText = 'Working…';
  }

  return (
    <dialog
      id={props.id}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={handleCancel}
    >
      <h2 className="dialog__title" id={titleId}>
        {props.title}
      </h2>
      <p id={messageId}>{props.message}</p>

      {props.error !== '' && (
        <p className="field__error" role="alert">
          {props.error}
        </p>
      )}

      {/* Cancel comes first, so it is the button that receives focus when the
          dialog opens. A stray press of Enter then does nothing harmful. */}
      <div className="dialog__actions">
        <button
          type="button"
          className="button"
          onClick={handleCancelClick}
          aria-disabled={props.isBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={handleConfirmClick}
          aria-disabled={props.isBusy}
        >
          {confirmText}
        </button>
      </div>
    </dialog>
  );
}

export default ConfirmDialog;
