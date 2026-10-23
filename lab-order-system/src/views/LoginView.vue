<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthUser } from '../composables/useAuthUser'

const isRegister = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const router = useRouter()
const { fetchOrCreateUserProfile } = useAuthUser()

const toggleMode = () => {
  isRegister.value = !isRegister.value
  errorMessage.value = ''
  successMessage.value = ''
}

const parseAuthError = (code: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address format is not valid.'
    case 'auth/user-disabled':
      return 'This user account has been disabled.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please verify your email and password.'
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.'
    case 'auth/weak-password':
      return 'The password must be at least 6 characters long.'
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a few moments.'
    default:
      return 'An authentication error occurred. Please try again.'
  }
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (isRegister.value && password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters long.'
    return
  }

  isLoading.value = true

  try {
    if (isRegister.value) {
      // 1. Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
      const user = userCredential.user

      // 2. Save user profile document in Firestore 'users' collection with default 'researcher' role
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        role: 'researcher',
        created_at: serverTimestamp()
      })

      await fetchOrCreateUserProfile(user)
      successMessage.value = 'Account created successfully! Redirecting...'
    } else {
      const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value)
      await fetchOrCreateUserProfile(userCredential.user)
    }

    router.push('/my-orders')
  } catch (err: any) {
    console.error('Auth error:', err)
    errorMessage.value = parseAuthError(err?.code || '')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-header">
        <div class="icon-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 2v7.31L4.2 18.26A2 2 0 0 0 5.86 21h12.28a2 2 0 0 0 1.66-2.74L14 9.31V2h-4z" />
            <path d="M8.5 2h7" />
            <path d="M7 16h10" />
          </svg>
        </div>
        <h1>IFT Lab Orders</h1>
        <p class="subtitle">
          {{ isRegister ? 'Register as a new researcher' : 'Sign in to access lab procurement portal' }}
        </p>
      </div>

      <div class="mode-tabs">
        <button
          type="button"
          :class="['tab-btn', { active: !isRegister }]"
          @click="isRegister && toggleMode()"
        >
          Sign In
        </button>
        <button
          type="button"
          :class="['tab-btn', { active: isRegister }]"
          @click="!isRegister && toggleMode()"
        >
          Create Account
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="email">Institutional Email</label>
          <input
            id="email"
            type="email"
            v-model.trim="email"
            required
            placeholder="researcher@ift.csic.es"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            v-model="password"
            required
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <div v-if="isRegister" class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            v-model="confirmPassword"
            required
            placeholder="••••••••"
            autocomplete="new-password"
          />
        </div>

        <div v-if="errorMessage" class="alert alert-error">
          <span>⚠️ {{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="alert alert-success">
          <span>✅ {{ successMessage }}</span>
        </div>

        <button type="submit" class="btn-submit" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span>{{ isLoading ? 'Processing...' : (isRegister ? 'Register Account' : 'Sign In') }}</span>
        </button>
      </form>

      <div class="login-footer">
        <p>
          {{ isRegister ? 'Already have an account?' : "Don't have an account yet?" }}
          <button type="button" class="link-btn" @click="toggleMode">
            {{ isRegister ? 'Sign in here' : 'Create an account here' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
  padding: 1.5rem;
}

.login-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 440px;
  padding: 2.25rem 2rem;
}

.login-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.icon-circle {
  width: 52px;
  height: 52px;
  background: #eff6ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  color: #2563eb;
}

.icon-circle svg {
  width: 28px;
  height: 28px;
}

.login-header h1 {
  font-size: 1.6rem;
  color: #0f172a;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.subtitle {
  color: #64748b;
  font-size: 0.9rem;
}

.mode-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.6rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.form-group input {
  padding: 0.75rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.form-group input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
}

.alert-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.alert-success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.btn-submit {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.85rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-submit:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: #64748b;
}

.link-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  margin-left: 0.25rem;
}

.link-btn:hover {
  color: #1d4ed8;
}
</style>
