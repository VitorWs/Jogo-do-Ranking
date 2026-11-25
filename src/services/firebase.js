import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCdtpiTmSpAYlVYH7hEVoIbpFJhM-dWIQg",
  authDomain: "jogo-do-ranking.firebaseapp.com",
  projectId: "jogo-do-ranking",
  storageBucket: "jogo-do-ranking.firebasestorage.app",
  messagingSenderId: "424366973759",
  appId: "1:424366973759:web:49388df8a411d24fd3298a",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
