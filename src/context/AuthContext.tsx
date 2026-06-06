import React, { createContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { loginWithGoogle, logout, createUserProfile } from '../lib/auth';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  /** True while the Firebase Auth SDK is resolving the initial auth state */
  loading: boolean;
  /** True while a logged-in user's Firestore profile document is being fetched */
  profileLoading: boolean;
  /** True when auth is resolved, user is logged in, but no Firestore profile doc exists yet */
  needsOnboarding: boolean;
  /** True when auth is resolved, profile exists, but username is not set */
  needsUsername: boolean;
  /** True when auth is resolved and no user is signed in (convenience flag for guest UI) */
  isGuest: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (cf: string, ac: string, lc: string, displayName: string, username: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]                       = useState<FirebaseUser | null>(null);
  const [profile, setProfile]                 = useState<UserProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [needsUsername, setNeedsUsername]     = useState<boolean>(false);
  const [loading, setLoading]                 = useState(true);
  const [profileLoading, setProfileLoading]   = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (currentUser) {
        setLoading(false);
        setProfileLoading(true);

        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const profileData = snapshot.data() as UserProfile;
              setProfile(profileData);
              setNeedsOnboarding(false);
              setNeedsUsername(!profileData.username);
            } else {
              setProfile(null);
              setNeedsOnboarding(true);
              setNeedsUsername(false);
            }
            setProfileLoading(false);
          },
          (error) => {
            console.error('Error listening to user profile:', error);
            setProfileLoading(false);
          }
        );
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
        setNeedsUsername(false);
        setLoading(false);
        setProfileLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      throw error;
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
      throw error;
    }
  };

  const completeOnboarding = async (cf: string, ac: string, lc: string, displayName: string, username: string) => {
    if (!user) throw new Error('No authenticated user found');
    
    // 1. Claim username first
    const lowerName = username.trim().toLowerCase();
    const usernameDocRef = doc(db, 'usernames', lowerName);
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(usernameDocRef);
      if (docSnap.exists()) {
        throw new Error('Username is already taken.');
      }
      transaction.set(usernameDocRef, { uid: user.uid });
    });

    // 2. Create profile
    await createUserProfile(user.uid, displayName, user.photoURL || '', cf, ac, lc, username);
  };

  // isGuest is true once auth has resolved and there is no signed-in user
  const isGuest = !loading && !user;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      profileLoading,
      needsOnboarding,
      needsUsername,
      isGuest,
      loginWithGoogle: handleLogin,
      logout:          handleLogout,
      completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
