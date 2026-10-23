<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from './firebase'
import { signOut } from 'firebase/auth'
import { useAuthUser } from './composables/useAuthUser'

const router = useRouter()
const route = useRoute()
const { currentUser, userRole, isAdmin } = useAuthUser()
const isLoggingOut = ref(false)

const handleLogout = async () => {
  isLoggingOut.value = true
  try {
    await signOut(auth)
    router.push('/login')
  } catch (err) {
    console.error('Error signing out:', err)
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header" v-if="currentUser && route.path !== '/login'">
      <div class="header-container">
        <div class="brand">
          <svg class="flask-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 2v7.31L4.2 18.26A2 2 0 0 0 5.86 21h12.28a2 2 0 0 0 1.66-2.74L14 9.31V2h-4z" />
            <path d="M8.5 2h7" />
            <path d="M7 16h10" />
          </svg>
          <div class="brand-text">
            <span class="brand-title">IFT Lab Orders</span>
            <span class="brand-sub">Institute for Theoretical Physics</span>
          </div>
        </div>

        <nav class="nav-links">
          <router-link to="/my-orders" class="nav-item" active-class="active">
            📋 My Orders
          </router-link>
          <router-link to="/create-order" class="nav-item" active-class="active">
            ➕ New Order
          </router-link>
          <!-- Only visible to admins -->
          <router-link v-if="isAdmin" to="/admin" class="nav-item admin-link" active-class="active">
            ⚙️ Admin Panel
          </router-link>
        </nav>

        <div class="user-menu">
          <div class="user-badge" :title="currentUser.email || ''">
            <span class="user-avatar">{{ (currentUser.email?.[0] || 'U').toUpperCase() }}</span>
            <span class="user-email">{{ currentUser.email }}</span>
            <span :class="['role-tag', { 'role-admin': isAdmin }]">
              {{ isAdmin ? 'Admin' : 'Researcher' }}
            </span>
          </div>
          <button class="btn-logout" @click="handleLogout" :disabled="isLoggingOut">
            {{ isLoggingOut ? 'Signing out...' : 'Sign out' }}
          </button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <router-view />
    </main>

    <footer class="app-footer">
      <p>© {{ new Date().getFullYear() }} IFT Orders System — Material & Reagent Procurement for Researchers</p>
    </footer>
  </div>
</template>

<style>
/* Global resets & typography */
:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;
  --bg-page: #f8fafc;
  --bg-card: #ffffff;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
  --radius: 10px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-page);
  color: var(--text-main);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header & Nav */
.app-header {
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--shadow-sm);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.flask-icon {
  width: 28px;
  height: 28px;
  color: var(--primary);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-weight: 700;
  font-size: 1.15rem;
  color: #1e293b;
  line-height: 1.2;
}

.brand-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.nav-item {
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  color: #475569;
  padding: 0.5rem 0.85rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: var(--primary);
}

.nav-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}

.admin-link {
  color: #7c3aed;
}

.admin-link:hover {
  background: #f5f3ff;
  color: #6d28d9;
}

.admin-link.active {
  background: #f5f3ff;
  color: #6d28d9;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f1f5f9;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.user-email {
  font-size: 0.85rem;
  color: #334155;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  font-size: 0.7rem;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 0.15rem 0.45rem;
  border-radius: 12px;
  text-transform: capitalize;
}

.role-tag.role-admin {
  background: #ede9fe;
  color: #6d28d9;
}

.btn-logout {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-logout:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #b91c1c;
}

.btn-logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Main Content Area */
.main-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* Footer */
.app-footer {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  background: #ffffff;
  margin-top: auto;
}

@media (max-width: 768px) {
  .header-container {
    flex-direction: column;
    align-items: stretch;
  }
  .nav-links {
    justify-content: center;
  }
  .user-menu {
    justify-content: space-between;
  }
}
</style>
