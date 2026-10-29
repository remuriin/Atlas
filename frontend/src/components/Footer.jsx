// The site footer.
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>Atlas is a hub for study reviewers made and shared by learners like you.</p>
        <p>
          <Link to="/terms">Terms of use and copyright</Link>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
