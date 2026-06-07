import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '../types';

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const logout = async () => {
  return signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userDocRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const createUserProfile = async (
  uid: string,
  displayName: string,
  photoURL: string,
  cfHandle: string,
  acHandle: string,
  lcHandle: string,
  username: string
): Promise<UserProfile> => {
  const profile: UserProfile = {
    uid,
    displayName,
    photoURL,
    username: username.trim(),
    handle_cf: cfHandle.trim(),
    handle_ac: acHandle.trim(),
    handle_lc: lcHandle.trim(),
    teams: [],
    xp: 0,
    rank: 'Newbie',
    streak: 0,
    totalSolves: 0,
    totalHours: 0,
    weeklyProblems: 0,
    weeklyHours: 0,
    badges: [],
    createdAt: serverTimestamp(),
  };

  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, profile);
  return profile;
};
