// The site footer.
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p className="site-footer__brand">
          <strong>Atlas</strong>
          Atlas is a hub for study reviewers made and shared by learners like you.
        </p>
        <nav aria-label="Footer">
          <ul className="site-footer__links">
            <li>
              <Link to="/browse">Browse reviewers</Link>
            </li>
            <li>
              <Link to="/upload">Share a reviewer</Link>
            </li>
            <li>
              <Link to="/terms">Terms of use and copyright</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
