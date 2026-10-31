// Switches between the light and dark themes.
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Icon from './Icon';

function ThemeToggle() {
  const themeContext = useContext(ThemeContext);
  const isDark = themeContext.theme === 'dark';

  let iconName = 'sun';
  let stateText = 'Off';
  if (isDark) {
    iconName = 'moon';
    stateText = 'On';
  }

  // aria-pressed tells screen readers whether dark mode is on. The On/Off word
  // shows the same thing on screen, so it is hidden from them to avoid hearing it twice.
  return (
    <button
      type="button"
      className="button button-quiet theme-toggle"
      aria-pressed={isDark}
      onClick={themeContext.toggleTheme}
    >
      <Icon name={iconName} />
      <span>Dark mode</span>
      <span className="theme-toggle-state" aria-hidden="true">
        {stateText}
      </span>
    </button>
  );
}

export default ThemeToggle;
