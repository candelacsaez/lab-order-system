import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBAELLC78zC52RtBIDqTSgmniiWWWF_7YI",
  authDomain: "site-commandes.firebaseapp.com",
  projectId: "site-commandes",
  storageBucket: "site-commandes.firebasestorage.app",
  messagingSenderId: "750568691347",
  appId: "1:750568691347:web:3df0b913b733cfe8355f66",
  measurementId: "G-0HBR5R9EXM"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app)
      }
    })
    .catch(() => {})
}
