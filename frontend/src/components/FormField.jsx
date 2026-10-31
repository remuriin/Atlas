// One labelled form field with an optional hint and error message.
//
// props:
//   id, label            required
//   type                 'text' (default), 'email', 'password', 'search', 'textarea', 'select', 'file'
//   value, onChange      onChange receives the normal change event
//   required             adds "(required)" to the label
//   hint, error          helper text and the current error message ('' for none)
//   autoComplete         lets browsers and password managers fill the field in
//   options              for 'select': a list of strings
//   placeholderOption    for 'select': text of the empty first choice
//   accept               for 'file': allowed file endings
//   maxLength, rows
//   min, max, step, inputMode   for 'number': the allowed range and the phone keyboard
import { useState } from 'react';
import Icon from './Icon';

function FormField(props) {
  // Only used by password fields.
  const [isPasswordShown, setIsPasswordShown] = useState(false);

  const type = props.type || 'text';
  const hintId = `${props.id}-hint`;
  const errorId = `${props.id}-error`;
  const hasError = Boolean(props.error);

  // aria-describedby links the hint and the error to the input, so a screen
  // reader reads them out together with the label.
  let describedBy = '';
  if (props.hint) {
    describedBy = hintId;
  }
  if (hasError) {
    describedBy = `${describedBy} ${errorId}`.trim();
  }
  if (describedBy === '') {
    describedBy = undefined;
  }

  let control = null;

  if (type === 'textarea') {
    control = (
      <textarea
        id={props.id}
        className="input"
        value={props.value}
        onChange={props.onChange}
        rows={props.rows || 5}
        maxLength={props.maxLength}
        required={props.required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
      />
    );
  } else if (type === 'select') {
    control = (
      <select
        id={props.id}
        className="input"
        value={props.value}
        onChange={props.onChange}
        required={props.required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
      >
        <option value="">{props.placeholderOption}</option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (type === 'file') {
    // A file input cannot have a "value" set by code, so it only reports changes.
    control = (
      <input
        id={props.id}
        className="input"
        type="file"
        accept={props.accept}
        onChange={props.onChange}
        required={props.required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
      />
    );
  } else if (type === 'password') {
    // The show/hide control is a real button, and its name ("Show password" or
    // "Hide password") always says what pressing it will do.
    let inputType = 'password';
    let toggleIcon = 'eye';
    let toggleText = 'Show';
    if (isPasswordShown) {
      inputType = 'text';
      toggleIcon = 'eye-off';
      toggleText = 'Hide';
    }

    control = (
      <div className="field-row">
        <input
          id={props.id}
          className="input"
          type={inputType}
          value={props.value}
          onChange={props.onChange}
          autoComplete={props.autoComplete}
          required={props.required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="button"
          aria-label={`${toggleText} ${props.label.toLowerCase()}`}
          onClick={() => setIsPasswordShown(!isPasswordShown)}
        >
          <Icon name={toggleIcon} />
          {toggleText}
        </button>
      </div>
    );
  } else {
    control = (
      <input
        id={props.id}
        className="input"
        type={type}
        value={props.value}
        onChange={props.onChange}
        autoComplete={props.autoComplete}
        maxLength={props.maxLength}
        min={props.min}
        max={props.max}
        step={props.step}
        inputMode={props.inputMode}
        required={props.required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
      />
    );
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={props.id}>
        {props.label}
        {props.required && <span className="field-required"> (required)</span>}
      </label>
      {props.hint && (
        <p className="field-hint" id={hintId}>
          {props.hint}
        </p>
      )}
      {control}
      {hasError && (
        <p className="field-error" id={errorId}>
          <Icon name="alert" />
          <span>
            <span className="visually-hidden">Error: </span>
            {props.error}
          </span>
        </p>
      )}
    </div>
  );
}

export default FormField;
