// Shown while something is loading. The text is announced by screen readers;
// the spinning ring is only decoration.
function Spinner(props) {
  const label = props.label || 'Loading…';

  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true"></span>
      <span>{label}</span>
    </div>
  );
}

export default Spinner;
