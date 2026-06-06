import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAG_hoTfB7Hlq5HBfBj2g7F5E6cJwaYrSM",
  authDomain: "cptracker911.firebaseapp.com",
  projectId: "cptracker911",
  storageBucket: "cptracker911.firebasestorage.app",
  messagingSenderId: "1062789226657",
  appId: "1:1062789226657:web:d5ec114ba44826e1fd50e0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  const teamsCol = collection(db, 'teams');
  const snapshot = await getDocs(teamsCol);
  if (snapshot.empty) {
    console.log('No teams found.');
  } else {
    snapshot.docs.forEach(doc => {
      console.log(`Team: ${doc.data().name} | Code: ${doc.data().inviteCode}`);
    });
  }
} catch (e) {
  console.error("Error querying teams:", e);
}
process.exit(0);
