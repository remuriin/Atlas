// A responsive grid of study reviewer cards:
// one column on phones, two on tablets, three on desktops.
// props: items, headingLevel, showOwnerActions, onDelete (see ReviewerCard)
import ReviewerCard from './ReviewerCard';

function ReviewerList(props) {
  return (
    <ul className="reviewer-grid">
      {props.items.map((reviewer) => (
        <li key={reviewer.id}>
          <ReviewerCard
            reviewer={reviewer}
            headingLevel={props.headingLevel}
            showOwnerActions={props.showOwnerActions}
            onDelete={props.onDelete}
          />
        </li>
      ))}
    </ul>
  );
}

export default ReviewerList;
