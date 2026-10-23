// The page frame (skip link, header, main area, footer) and the list of routes.
import { useContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Footer from './components/Footer';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import SkipLink from './components/SkipLink';
import EditReviewerPage from './pages/EditReviewerPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ReviewerPage from './pages/ReviewerPage';
import SavedPage from './pages/SavedPage';
import StudyPage from './pages/StudyPage';
import UploadPage from './pages/UploadPage';

function App() {
  const auth = useContext(AuthContext);

  // Giving a page a "key" that changes on login/logout makes React rebuild it
  // from scratch, so lists never keep "Upvoted" marks from the previous user.
  let userKey = 'visitor';
  if (auth.firebaseUser) {
    userKey = auth.firebaseUser.uid;
  }

  return (
    <div className="app">
      <SkipLink />
      <Header />

      {/* tabIndex -1 lets the skip link move focus here without adding a Tab stop. */}
      <main id="main-content" className="container main" tabIndex="-1">
        <Routes>
          <Route path="/" element={<HomePage key={userKey} />} />
          <Route path="/reviewers/:id" element={<ReviewerPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewers/:id/edit"
            element={
              <ProtectedRoute>
                <EditReviewerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage key={userKey} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <SavedPage key={userKey} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved/:savedId"
            element={
              <ProtectedRoute>
                <StudyPage key={userKey} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
