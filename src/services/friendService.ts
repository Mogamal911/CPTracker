import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  documentId,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile, Friendship } from '../types';

/** Add a friend (one-directional follow) */
export async function addFriend(uid: string, friendUid: string): Promise<void> {
  if (uid === friendUid) {
    throw new Error('You cannot add yourself as a friend.');
  }
  const friendshipRef = doc(db, 'friendships', uid, 'friends', friendUid);
  const data: Friendship = {
    friendUid,
    addedAt: Timestamp.now(),
  };
  await setDoc(friendshipRef, data);
}

/** Remove a friend */
export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  const friendshipRef = doc(db, 'friendships', uid, 'friends', friendUid);
  await deleteDoc(friendshipRef);
}

/** Search users by username using prefix match on the usernames collection */
export async function searchUsersByUsername(searchQuery: string): Promise<UserProfile[]> {
  const cleaned = searchQuery.trim().toLowerCase();
  if (!cleaned) return [];

  const usernamesRef = collection(db, 'usernames');
  const q = query(
    usernamesRef,
    where(documentId(), '>=', cleaned),
    where(documentId(), '<=', cleaned + '\uf8ff')
  );

  const snap = await getDocs(q);
  const uids = snap.docs.map(d => (d.data() as { uid: string }).uid);
  if (uids.length === 0) return [];

  // Firestore "in" query is limited to 30 uids
  const uidsChunk = uids.slice(0, 30);
  const usersRef = collection(db, 'users');
  const usersQuery = query(usersRef, where('uid', 'in', uidsChunk));
  const usersSnap = await getDocs(usersQuery);

  return usersSnap.docs.map(d => d.data() as UserProfile);
}
