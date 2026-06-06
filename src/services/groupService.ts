import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Team } from '../types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Create a new group (team). Creator is auto-added as member and to their teams[] array. */
export async function createGroup(
  name: string,
  description: string,
  creatorUid: string
): Promise<string> {
  if (!name.trim()) throw new Error('Group name cannot be empty');

  const inviteCode        = generateInviteCode();
  const teamsCollection   = collection(db, 'teams');
  const teamDocRef        = doc(teamsCollection);
  const teamId            = teamDocRef.id;

  const newTeam: Team = {
    teamId,
    name:        name.trim(),
    description: description.trim() || undefined,
    inviteCode,
    createdBy:   creatorUid,
    members:     [creatorUid],
    createdAt:   Timestamp.now(),
  };

  await setDoc(teamDocRef, newTeam);
  await updateDoc(doc(db, 'users', creatorUid), { teams: arrayUnion(teamId) });

  return teamId;
}

/** Join a group via invite code. Updates both the team's members[] and the user's teams[]. */
export async function joinGroupByCode(inviteCode: string, userUid: string): Promise<string> {
  const cleanedCode = inviteCode.trim().toUpperCase();
  if (!cleanedCode) throw new Error('Invite code cannot be empty');

  const q        = query(collection(db, 'teams'), where('inviteCode', '==', cleanedCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) throw new Error('Invalid invite code — no group found');

  const teamDoc = snapshot.docs[0];
  const teamId  = teamDoc.id;
  const data    = teamDoc.data() as Team;

  if (data.members.includes(userUid)) throw new Error('You are already a member of this group');

  await updateDoc(teamDoc.ref, { members: arrayUnion(userUid) });
  await updateDoc(doc(db, 'users', userUid), { teams: arrayUnion(teamId) });

  return teamId;
}

/** Leave a group. Removes user from team's members[] and their own teams[]. */
export async function leaveGroup(teamId: string, userUid: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { members: arrayRemove(userUid) });
  await updateDoc(doc(db, 'users', userUid), { teams: arrayRemove(teamId) });
}

/** Fetch a team by its invite code (public — no auth required due to Firestore rules). */
export async function getGroupByInviteCode(inviteCode: string): Promise<Team | null> {
  const q        = query(
    collection(db, 'teams'),
    where('inviteCode', '==', inviteCode.trim().toUpperCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Team;
}
