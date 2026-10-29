// A strand shown as a small colored pill. Choosing it opens the feed filtered to
// that strand, which is what a pill-shaped label suggests it will do.
// props: strand
import { Link } from 'react-router-dom';
import { strandSlug } from '../services/categories';

function StrandLink(props) {
  // The link is taller than the pill inside it, so it is easy to tap (44px)
  // while the pill itself stays small.
  return (
    <Link className="chip-link" to={`/browse?strand=${encodeURIComponent(props.strand)}`}>
      <span className={`label label--strand strand--${strandSlug(props.strand)}`}>
        <span className="visually-hidden">Strand: </span>
        {props.strand}
      </span>
    </Link>
  );
}

export default StrandLink;
