import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';

/** Validates username format. Returns error message if invalid, or null if valid. */
export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Username must be between 3 and 20 characters.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

/** Check if a username is available in real time. Returns true if available. */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const err = validateUsername(username);
  if (err) return false;
  
  const lowerName = username.trim().toLowerCase();
  const usernameDocRef = doc(db, 'usernames', lowerName);
  const docSnap = await getDoc(usernameDocRef);
  return !docSnap.exists();
}

/** Atomic transaction to claim a username and release the old one (if applicable). */
export async function claimUsername(uid: string, username: string, oldUsername?: string): Promise<void> {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  
  const lowerName = username.trim().toLowerCase();
  const lowerOldName = oldUsername?.trim().toLowerCase();
  
  if (lowerName === lowerOldName) {
    // If username is unchanged (or case change only), update user doc to match requested case
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', uid);
      transaction.update(userRef, { username: username.trim() });
    });
    return;
  }
  
  await runTransaction(db, async (transaction) => {
    const newUsernameRef = doc(db, 'usernames', lowerName);
    const newDoc = await transaction.get(newUsernameRef);
    
    if (newDoc.exists() && newDoc.data()?.uid !== uid) {
      throw new Error('Username is already taken.');
    }
    
    // 1. Claim new username
    transaction.set(newUsernameRef, { uid });
    
    // 2. Delete old username doc if it existed and is different
    if (lowerOldName) {
      const oldUsernameRef = doc(db, 'usernames', lowerOldName);
      transaction.delete(oldUsernameRef);
    }
    
    // 3. Update the user profile document with the casing-preserved username
    const userRef = doc(db, 'users', uid);
    transaction.update(userRef, { username: username.trim() });
  });
}
