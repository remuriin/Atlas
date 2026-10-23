// A subject shown as a small colored pill. Choosing it opens the feed filtered to
// that subject, which is what a pill-shaped label suggests it will do.
// props: subject
import { Link } from 'react-router-dom';
import { subjectSlug } from '../services/subjects';

function SubjectLink(props) {
  // The link is taller than the pill inside it, so it is easy to tap (44px)
  // while the pill itself stays small.
  return (
    <Link className="chip-link" to={`/?subject=${encodeURIComponent(props.subject)}`}>
      <span className={`label label--subject subject--${subjectSlug(props.subject)}`}>
        <span className="visually-hidden">Subject: </span>
        {props.subject}
      </span>
    </Link>
  );
}

export default SubjectLink;
