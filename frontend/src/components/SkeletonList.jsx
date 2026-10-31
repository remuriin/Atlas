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
    <ul className="review-grid" aria-hidden="true">
      {placeholders.map((number) => (
        <li key={number}>
          <div className="review">
            <div className="skeleton-body">
              <span className="skeleton-chip"></span>
              <span className="skeleton-title"></span>
              <span className="skeleton-line"></span>
              <span className="skeleton-line"></span>
              <span className="skeleton-short"></span>
              <span className="skeleton-short"></span>
            </div>
            <div className="review-footer">
              <span className="skeleton-button"></span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default SkeletonList;
