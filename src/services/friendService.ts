import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  documentId,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

/** ─── O(1) Username Lookup ─── */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const cleaned = username.trim().toLowerCase();
  const usernameDoc = await getDoc(doc(db, 'usernames', cleaned));
  if (!usernameDoc.exists()) return null;
  const uid = (usernameDoc.data() as { uid: string }).uid;
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  return userDoc.data() as UserProfile;
}

/** ─── Prefix Search Users ─── */
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

  const uidsChunk = uids.slice(0, 30);
  const usersRef = collection(db, 'users');
  const usersQuery = query(usersRef, where('uid', 'in', uidsChunk));
  const usersSnap = await getDocs(usersQuery);

  return usersSnap.docs.map(d => d.data() as UserProfile);
}

/** ─── Relationship Verification ─── */
export async function checkFollowing(uid: string, targetUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'follows', uid, 'following', targetUid));
  return snap.exists();
}

export async function checkFriendship(uid: string, targetUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'friendships', uid, 'friends', targetUid));
  return snap.exists();
}

export async function checkPendingRequest(
  uid: string,
  targetUid: string
): Promise<{ isPending: boolean; fromMe: boolean; requestId?: string } | null> {
  const q1 = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', uid),
    where('toUid', '==', targetUid),
    where('status', '==', 'pending')
  );
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    return { isPending: true, fromMe: true, requestId: snap1.docs[0].id };
  }

  const q2 = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', targetUid),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    return { isPending: true, fromMe: false, requestId: snap2.docs[0].id };
  }

  return null;
}

/** ─── Following Actions ─── */
export async function followUser(uid: string, targetUid: string): Promise<void> {
  if (uid === targetUid) throw new Error('You cannot follow yourself.');
  const batch = writeBatch(db);

  const followingRef = doc(db, 'follows', uid, 'following', targetUid);
  batch.set(followingRef, { targetUid, followedAt: Timestamp.now() });

  const followersRef = doc(db, 'follows', targetUid, 'followers', uid);
  batch.set(followersRef, { followerUid: uid, followedAt: Timestamp.now() });

  await batch.commit();
}

export async function unfollowUser(uid: string, targetUid: string): Promise<void> {
  const batch = writeBatch(db);

  const followingRef = doc(db, 'follows', uid, 'following', targetUid);
  batch.delete(followingRef);

  const followersRef = doc(db, 'follows', targetUid, 'followers', uid);
  batch.delete(followersRef);

  await batch.commit();
}

/** ─── Friend Requests Actions ─── */
export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromUsername: string,
  fromPhoto: string
): Promise<void> {
  if (fromUid === toUid) throw new Error('You cannot send a friend request to yourself.');
  const batch = writeBatch(db);

  const requestRef = doc(collection(db, 'friendRequests'));
  const requestId = requestRef.id;

  batch.set(requestRef, {
    requestId,
    fromUid,
    toUid,
    status: 'pending',
    createdAt: Timestamp.now(),
  });

  const notificationRef = doc(db, 'notifications', toUid, 'items', requestId);
  batch.set(notificationRef, {
    type: 'friend_request',
    fromUid,
    fromUsername,
    fromPhoto,
    requestId,
    read: false,
    createdAt: Timestamp.now(),
  });

  await batch.commit();
}

export async function cancelFriendRequest(requestId: string, toUid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friendRequests', requestId));
  batch.delete(doc(db, 'notifications', toUid, 'items', requestId));
  await batch.commit();
}

export async function acceptFriendRequest(
  requestId: string,
  toUid: string,
  fromUid: string
): Promise<void> {
  const batch = writeBatch(db);

  const requestRef = doc(db, 'friendRequests', requestId);
  batch.update(requestRef, { status: 'accepted', resolvedAt: Timestamp.now() });

  const notificationRef = doc(db, 'notifications', toUid, 'items', requestId);
  batch.update(notificationRef, { read: true });

  const friendRef1 = doc(db, 'friendships', fromUid, 'friends', toUid);
  batch.set(friendRef1, { friendUid: toUid, since: Timestamp.now() });

  const friendRef2 = doc(db, 'friendships', toUid, 'friends', fromUid);
  batch.set(friendRef2, { friendUid: fromUid, since: Timestamp.now() });

  await batch.commit();
}

export async function denyFriendRequest(requestId: string, toUid: string): Promise<void> {
  const batch = writeBatch(db);

  const requestRef = doc(db, 'friendRequests', requestId);
  batch.update(requestRef, { status: 'denied', resolvedAt: Timestamp.now() });

  const notificationRef = doc(db, 'notifications', toUid, 'items', requestId);
  batch.update(notificationRef, { read: true });

  await batch.commit();
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  const batch = writeBatch(db);

  const friendRef1 = doc(db, 'friendships', uid, 'friends', friendUid);
  batch.delete(friendRef1);

  const friendRef2 = doc(db, 'friendships', friendUid, 'friends', uid);
  batch.delete(friendRef2);

  // Clean up any friend requests between them
  const requestsRef = collection(db, 'friendRequests');
  const q1 = query(requestsRef, where('fromUid', '==', uid), where('toUid', '==', friendUid));
  const q2 = query(requestsRef, where('fromUid', '==', friendUid), where('toUid', '==', uid));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  snap1.docs.forEach(docSnap => batch.delete(docSnap.ref));
  snap2.docs.forEach(docSnap => batch.delete(docSnap.ref));

  await batch.commit();
}
