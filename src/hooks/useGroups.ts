import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  createGroup as apiCreate,
  joinGroupByCode as apiJoin,
  leaveGroup as apiLeave,
} from '../services/groupService';
import type { Team } from '../types';

export function useGroups() {
  const { profile, user } = useAuth();
  const [groups, setGroups]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Track individual team subscriptions via a Map keyed by teamId
  const groupMapRef = useRef<Map<string, Team>>(new Map());

  useEffect(() => {
    const teamIds = profile?.teams ?? [];

    if (teamIds.length === 0) {
      groupMapRef.current.clear();
      setGroups([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Subscribe to each team document
    teamIds.forEach(teamId => {
      const teamRef = doc(db, 'teams', teamId);
      const unsub   = onSnapshot(
        teamRef,
        (snap) => {
          if (snap.exists()) {
            groupMapRef.current.set(teamId, snap.data() as Team);
          } else {
            groupMapRef.current.delete(teamId);
          }
          // Re-order to match profile.teams order
          setGroups(
            (profile?.teams ?? [])
              .map(id => groupMapRef.current.get(id))
              .filter(Boolean) as Team[]
          );
        },
        (err) => console.error(`Error listening to team ${teamId}:`, err)
      );
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.teams?.join(',')]);

  const createGroup = async (name: string, description: string = '') => {
    if (!user) throw new Error('Must be signed in to create a group');
    setLoading(true);
    setError(null);
    try {
      return await apiCreate(name, description, user.uid);
    } catch (err: any) {
      const msg = err.message || 'Failed to create group';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (inviteCode: string) => {
    if (!user) throw new Error('Must be signed in to join a group');
    setLoading(true);
    setError(null);
    try {
      return await apiJoin(inviteCode, user.uid);
    } catch (err: any) {
      const msg = err.message || 'Failed to join group';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async (teamId: string) => {
    if (!user) throw new Error('Must be signed in to leave a group');
    setLoading(true);
    setError(null);
    try {
      await apiLeave(teamId, user.uid);
    } catch (err: any) {
      const msg = err.message || 'Failed to leave group';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return { groups, loading, error, createGroup, joinGroup, leaveGroup };
}
