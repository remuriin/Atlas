// The site header: logo, main menu, theme switch, and account links.
import { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { logout } from '../services/authService';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';

function Header() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  // Only matters on small screens, where the menu is tucked behind a button.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    navigate('/', { state: { flash: 'You are now logged out.' } });
  };

  let navClassName = 'site-nav';
  let menuIcon = 'menu';
  if (isMenuOpen) {
    navClassName = 'site-nav site-nav--open';
    menuIcon = 'close';
  }

  let displayName = '';
  if (auth.profile) {
    displayName = auth.profile.displayName;
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="site-logo" to="/">
          <Icon name="book" />
          LearnHub
        </Link>

        {/* On phones the menu is closed by default, so "Sign up" also sits
            in the header bar where new visitors can see it straight away.
            CSS shows only one of the two Sign up links at a time. */}
        {!auth.firebaseUser && !auth.isLoading && (
          <Link className="button button--primary site-header__cta" to="/register">
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
          <ul className="site-nav__list">
            <li>
              <NavLink className="site-nav__link" to="/" end>
                <Icon name="home" />
                Browse
              </NavLink>
            </li>
            {auth.firebaseUser && (
              <li>
                <NavLink className="site-nav__link" to="/saved">
                  <Icon name="bookmark" />
                  Saved
                </NavLink>
              </li>
            )}
            <li>
              <NavLink className="site-nav__link" to="/upload">
                <Icon name="upload" />
                Upload
              </NavLink>
            </li>
            {auth.firebaseUser && (
              <li>
                <NavLink className="site-nav__link" to="/profile">
                  <Icon name="user" />
                  Profile
                </NavLink>
              </li>
            )}
          </ul>

          <div className="site-nav__actions">
            {auth.firebaseUser && displayName !== '' && (
              <span className="site-nav__user">Logged in as {displayName}</span>
            )}
            <ThemeToggle />
            {auth.firebaseUser && (
              <button type="button" className="button" onClick={handleLogout}>
                Log out
              </button>
            )}
            {!auth.firebaseUser && !auth.isLoading && (
              <Link className="button" to="/login">
                Log in
              </Link>
            )}
            {!auth.firebaseUser && !auth.isLoading && (
              <Link className="button button--primary site-nav__signup" to="/register">
                Sign up
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;
