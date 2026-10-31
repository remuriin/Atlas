// A pop-up for reporting a study reviewer: pick a reason, optionally explain.
// Built on the browser's <dialog> like ConfirmDialog, so focus, Esc, and the
// page behind are handled the same way.
//
// props:
//   isOpen        true to show it
//   title         the reviewer's title, shown in the heading
//   isBusy        true while the report is being sent
//   error         message to show if sending failed ('' for none)
//   onSubmit      called with (reason, details)
//   onCancel
import { useEffect, useState } from 'react';
import { REPORT_DETAILS_MAX, REPORT_REASONS } from '../services/reportsService';
import FormField from './FormField';

const DIALOG_ID = 'report-reviewer-dialog';

function ReportDialog(props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    const dialog = document.getElementById(DIALOG_ID);
    if (!dialog) {
      return;
    }
    if (props.isOpen && !dialog.open) {
      // Every report starts empty.
      setReason('');
      setDetails('');
      setReasonError('');
      dialog.showModal();
    }
    if (!props.isOpen && dialog.open) {
      dialog.close();
    }
  }, [props.isOpen]);

  const handleCancel = (event) => {
    event.preventDefault();
    if (!props.isBusy) {
      props.onCancel();
    }
  };

  const handleCancelClick = () => {
    if (!props.isBusy) {
      props.onCancel();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (props.isBusy) {
      return;
    }
    if (reason === '') {
      setReasonError('Choose a reason.');
      const firstChoice = document.getElementById('report-reason-0');
      if (firstChoice) {
        firstChoice.focus();
      }
      return;
    }
    setReasonError('');
    props.onSubmit(reason, details.trim());
  };

  let submitText = 'Send report';
  if (props.isBusy) {
    submitText = 'Sending…';
  }

  return (
    <dialog
      id={DIALOG_ID}
      className="dialog"
      aria-labelledby={`${DIALOG_ID}-title`}
      onCancel={handleCancel}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="dialog-title" id={`${DIALOG_ID}-title`}>
          Report “{props.title}”
        </h2>
        <p className="small">
          An admin will look at it. After 3 reports it is hidden until then. Your name is not shown
          to anyone.
        </p>

        <fieldset className="choice-list" aria-describedby={reasonError ? 'report-reason-error' : undefined}>
          <legend className="field-label">Reason (required)</legend>
          {REPORT_REASONS.map((option, index) => (
            <div className="choice" key={option.name}>
              <input
                type="radio"
                id={`report-reason-${index}`}
                name="report-reason"
                value={option.name}
                checked={reason === option.name}
                onChange={() => setReason(option.name)}
              />
              <label htmlFor={`report-reason-${index}`}>
                <span className="choice-name">{option.name}</span>
                <span className="choice-hint">{option.hint}</span>
              </label>
            </div>
          ))}
          {reasonError !== '' && (
            <p className="field-error" id="report-reason-error" role="alert">
              {reasonError}
            </p>
          )}
        </fieldset>

        <FormField
          id="report-details"
          label="Details"
          type="textarea"
          rows={3}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={REPORT_DETAILS_MAX}
          hint="Optional. For example: which part is wrong, or where it was copied from."
        />

        {props.error !== '' && (
          <p className="field-error" role="alert">
            {props.error}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="button" onClick={handleCancelClick} aria-disabled={props.isBusy}>
            Cancel
          </button>
          <button type="submit" className="button-green" aria-disabled={props.isBusy}>
            {submitText}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default ReportDialog;
