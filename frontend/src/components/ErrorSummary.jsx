// A list of everything wrong with a form, shown at the top after a failed submit.
// Each item is a link that jumps to the field it is about.
// props.errors: [{ fieldId: 'title', message: 'Enter a title.' }]

function ErrorSummary(props) {
  if (props.errors.length === 0) {
    return null;
  }

  const handleLinkClick = (event, fieldId) => {
    // Put the cursor in the field instead of only scrolling to it.
    event.preventDefault();
    const field = document.getElementById(fieldId);
    if (field) {
      field.focus();
    }
  };

  let heading = 'There is 1 problem to fix';
  if (props.errors.length > 1) {
    heading = `There are ${props.errors.length} problems to fix`;
  }

  // role="alert" makes screen readers announce the summary as soon as it appears.
  return (
    <div className="alert error" role="alert">
      <div className="alert-body">
        <h2 className="errors-title">{heading}</h2>
        <ul className="errors-list">
          {props.errors.map((error) => (
            <li key={error.fieldId}>
              <a href={`#${error.fieldId}`} onClick={(event) => handleLinkClick(event, error.fieldId)}>
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ErrorSummary;
