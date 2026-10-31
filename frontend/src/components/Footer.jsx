// The site footer.
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-brand">
          <strong>Atlas</strong>
          Atlas is a hub for study reviewers made and shared by learners like you.
        </p>
        <nav aria-label="Footer">
          <ul className="footer-links">
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
