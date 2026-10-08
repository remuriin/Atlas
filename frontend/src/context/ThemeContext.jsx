// Shares the current color theme ("light" or "dark") with the whole app.
import { createContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'learnhub-theme';

export const ThemeContext = createContext(null);

export function ThemeProvider(props) {
  // The small script in index.html has already picked a theme before React
  // started (saved choice first, then the device setting), so start from that.
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  // Keep the <html> attribute (which the CSS reads) in step with React.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    let nextTheme = 'dark';
    if (theme === 'dark') {
      nextTheme = 'light';
    }
    setTheme(nextTheme);

    // Only a choice the visitor made is saved. Until then the device setting decides.
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (err) {
      // Storage can be blocked (private browsing). The theme still changes for this visit.
    }
  };

  const value = { theme: theme, toggleTheme: toggleTheme };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}
