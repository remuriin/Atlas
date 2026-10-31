// The starting point: puts the React app on the page.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';

// React Router prints upgrade notices in the console unless these two future
// options are answered. v7_startTransition stays off on purpose: with it on,
// page changes are delayed slightly, and logging out of a protected page could
// land on the login page instead of the home page.
const routerFutureFlags = { v7_startTransition: false, v7_relativeSplatPath: true };

// The app decides where each page starts (top of a new page, or the remembered
// spot in the feed after Back), so the browser's own guess is switched off.
window.history.scrollRestoration = 'manual';

// The providers wrap the whole app so any component can read the theme and the login.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={routerFutureFlags}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
