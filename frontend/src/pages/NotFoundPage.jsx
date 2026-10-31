// Shown for any address that does not match a page.
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';

function NotFoundPage() {
  return (
    <div className="notfound">
      <PageHeading title="Page not found" />
      <p>There is nothing at this address. The link may be old, or it may have a typing mistake.</p>
      <div>
        <Link className="button-green" to="/browse">
          Browse study reviewers
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
