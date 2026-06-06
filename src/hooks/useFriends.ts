import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { addFriend as apiAddFriend, removeFriend as apiRemoveFriend } from '../services/friendService';

export function useFriends() {
  const { user } = useAuth();
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setFriendUids([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const friendsRef = collection(db, 'friendships', user.uid, 'friends');
    const unsubscribe = onSnapshot(
      friendsRef,
      (snapshot) => {
        const uids = snapshot.docs.map(doc => doc.id);
        setFriendUids(uids);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to friends:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addFriend = async (friendUid: string) => {
    if (!user) throw new Error('Must be signed in to add friends.');
    await apiAddFriend(user.uid, friendUid);
  };

  const removeFriend = async (friendUid: string) => {
    if (!user) throw new Error('Must be signed in to remove friends.');
    await apiRemoveFriend(user.uid, friendUid);
  };

  return {
    friendUids,
    loading,
    addFriend,
    removeFriend,
  };
}
