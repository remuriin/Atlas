// Shares "who is logged in" with the whole app.
//   firebaseUser: the Firebase account (null when logged out)
//   profile:      the matching LearnHub profile from our API (display name, email)
//   isLoading:    true until Firebase has told us whether someone is logged in
import { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { getMyProfile } from '../services/profileService';

export const AuthContext = createContext(null);

export function AuthProvider(props) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Firebase calls this on page load, and again on every login and logout.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // Calling GET /api/me also creates the profile row for a brand new account.
      try {
        const loadedProfile = await getMyProfile();
        setProfile(loadedProfile);
      } catch (err) {
        // The person is still logged in; pages that need the profile show their own error.
        setProfile(null);
      }
      setIsLoading(false);
    });

    // Stop listening if the provider is ever removed.
    return unsubscribe;
  }, []);

  const value = {
    firebaseUser: firebaseUser,
    profile: profile,
    isLoading: isLoading,
    setProfile: setProfile,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}
