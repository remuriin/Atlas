// Grey placeholder cards shown while the feed loads. They take up about the
// same room as real cards, so the page does not jump when the content arrives.
// They are decoration only: the "Loading" sentence next to them is what
// screen readers announce.
// props: count (how many placeholders to draw)

function SkeletonList(props) {
  const placeholders = [];
  for (let number = 1; number <= props.count; number += 1) {
    placeholders.push(number);
  }

  return (
    <ul className="reviewer-grid" aria-hidden="true">
      {placeholders.map((number) => (
        <li key={number}>
          <div className="card reviewer-card">
            <div className="reviewer-card__body skeleton-card__body">
              <span className="skeleton skeleton--chip"></span>
              <span className="skeleton skeleton--title"></span>
              <span className="skeleton skeleton--line"></span>
              <span className="skeleton skeleton--line"></span>
              <span className="skeleton skeleton--short"></span>
              <span className="skeleton skeleton--short"></span>
            </div>
            <div className="reviewer-card__footer">
              <span className="skeleton skeleton--button"></span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default SkeletonList;
