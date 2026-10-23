import { ref, computed } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

export interface UserProfile {
  uid: string
  email: string | null
  role: 'researcher' | 'admin'
  created_at?: any
}

const currentUser = ref<User | null>(null)
const userRole = ref<'researcher' | 'admin' | null>(null)
const isAuthInitialized = ref(false)
const isLoadingProfile = ref(true)

export const isAdmin = computed(() => userRole.value === 'admin')

export const fetchOrCreateUserProfile = async (user: User): Promise<'researcher' | 'admin'> => {
  try {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const data = userSnap.data()
      const role = data?.role === 'admin' ? 'admin' : 'researcher'
      userRole.value = role
      return role
    } else {
      // User doesn't exist yet in the database: create document
      const defaultRole: 'researcher' = 'researcher'
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        role: defaultRole,
        created_at: serverTimestamp()
      })
      userRole.value = defaultRole
      return defaultRole
    }
  } catch (error) {
    console.error('Error fetching or creating user profile in Firestore:', error)
    userRole.value = 'researcher'
    return 'researcher'
  }
}

// Global listener initialization
let authListenerInitialized = false

export const initAuthListener = (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (authListenerInitialized) {
      resolve(currentUser.value)
      return
    }

    onAuthStateChanged(auth, async (user) => {
      currentUser.value = user
      if (user) {
        isLoadingProfile.value = true
        await fetchOrCreateUserProfile(user)
        isLoadingProfile.value = false
      } else {
        userRole.value = null
        isLoadingProfile.value = false
      }

      if (!authListenerInitialized) {
        authListenerInitialized = true
        isAuthInitialized.value = true
        resolve(user)
      }
    })
  })
}

export const useAuthUser = () => {
  return {
    currentUser,
    userRole,
    isAdmin,
    isAuthInitialized,
    isLoadingProfile,
    fetchOrCreateUserProfile
  }
}
