// The site header: logo, main menu, theme switch, and account links.
import { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { logout } from '../services/authService';
import Avatar from './Avatar';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';

function Header() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  // Only matters on small screens, where the menu is tucked behind a button.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // "Log out" asks first, so a stray tap does not end the session.
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // Close the menu after moving to another page, so it does not cover the new one.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Esc closes the open menu and returns focus to the button that opened it.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      // While a pop-up (such as "Log out?") is open, Esc belongs to the pop-up only.
      if (document.querySelector('dialog[open]')) {
        return;
      }
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        const menuButton = document.getElementById('menu-button');
        if (menuButton) {
          menuButton.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      setIsLogoutOpen(false);
      // On the home page the address does not change, so close the phone menu here.
      setIsMenuOpen(false);
      navigate('/', { state: { flash: 'You are now logged out.' } });
    } catch (err) {
      setLogoutError('Could not log out. Check your internet connection and try again.');
    }
    setIsLoggingOut(false);
  };

  const handleLogoutCancel = () => {
    setIsLogoutOpen(false);
    setLogoutError('');
  };

  let navClassName = 'site-nav';
  let menuIcon = 'menu';
  if (isMenuOpen) {
    navClassName = 'site-nav site-nav-open';
    menuIcon = 'close';
  }

  let displayName = '';
  if (auth.profile) {
    displayName = auth.profile.displayName;
  }

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="site-logo" to="/">
          {/* Empty alt: the word "Atlas" beside it already names the link. */}
          <img className="site-logo-mark" src="/logo.png" alt="" width="32" height="32" />
          Atlas
        </Link>

        {/* On phones the menu is closed by default, so "Sign up" also sits
            in the header bar where new visitors can see it straight away.
            CSS shows only one of the two Sign up links at a time. */}
        {!auth.firebaseUser && !auth.isLoading && (
          <Link className="button button-primary site-header-cta" to="/register">
            Sign up
          </Link>
        )}

        <button
          type="button"
          id="menu-button"
          className="button menu-button"
          aria-expanded={isMenuOpen}
          aria-controls="main-menu"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Icon name={menuIcon} />
          Menu
        </button>

        <nav id="main-menu" className={navClassName} aria-label="Main">
          <ul className="site-nav-list">
            <li>
              <NavLink className="site-nav-link" to="/browse">
                <Icon name="home" />
                Browse
              </NavLink>
            </li>
            {auth.firebaseUser && (
              <li>
                <NavLink className="site-nav-link" to="/saved">
                  <Icon name="bookmark" />
                  Saved
                </NavLink>
              </li>
            )}
            <li>
              <NavLink className="site-nav-link" to="/upload">
                <Icon name="upload" />
                Upload
              </NavLink>
            </li>
            {auth.firebaseUser && (
              <li>
                <NavLink className="site-nav-link" to="/profile">
                  <Icon name="user" />
                  Profile
                </NavLink>
              </li>
            )}
            {auth.profile && auth.profile.role === 'admin' && (
              <li>
                <NavLink className="site-nav-link" to="/admin">
                  <Icon name="alert" />
                  Reports
                </NavLink>
              </li>
            )}
          </ul>

          <div className="site-nav-actions">
            {auth.firebaseUser && displayName !== '' && (
              <span className="site-nav-user">
                <Avatar photoUrl={auth.firebaseUser.photoURL} name={displayName} size="small" />
                <span>Logged in as {displayName}</span>
              </span>
            )}
            <ThemeToggle />
            {auth.firebaseUser && (
              <button
                type="button"
                id="logout-button"
                className="button"
                onClick={() => setIsLogoutOpen(true)}
              >
                Log out
              </button>
            )}
            {!auth.firebaseUser && !auth.isLoading && (
              <Link className="button" to="/login">
                Log in
              </Link>
            )}
            {!auth.firebaseUser && !auth.isLoading && (
              <Link className="button button-primary site-nav-signup" to="/register">
                Sign up
              </Link>
            )}
          </div>
        </nav>
      </div>

      <ConfirmDialog
        id="logout-dialog"
        isOpen={isLogoutOpen}
        title="Log out of Atlas?"
        message="You'll need to log in again to see your saved study reviewers, notes, and flashcards."
        confirmLabel="Log out"
        isBusy={isLoggingOut}
        error={logoutError}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </header>
  );
}

export default Header;
