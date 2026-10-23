import { createRouter, createWebHistory } from 'vue-router'
import { initAuthListener, useAuthUser } from '../composables/useAuthUser'

import LoginView from '../views/LoginView.vue'
import CreateOrder from '../views/CreateOrder.vue'
import MyOrders from '../views/MyOrders.vue'
import ManageOrders from '../views/ManageOrders.vue'

const routes = [
  {
    path: '/',
    redirect: '/my-orders'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView
  },
  {
    path: '/create-order',
    name: 'CreateOrder',
    component: CreateOrder,
    meta: { requiresAuth: true }
  },
  {
    path: '/my-orders',
    name: 'MyOrders',
    component: MyOrders,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'ManageOrders',
    component: ManageOrders,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  // Backward compatibility redirects
  {
    path: '/mis-pedidos',
    redirect: '/my-orders'
  },
  {
    path: '/crear-pedido',
    redirect: '/create-order'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  await initAuthListener()
  const { currentUser, isAdmin } = useAuthUser()

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)

  if (requiresAuth && !currentUser.value) {
    return '/login'
  }

  if (to.path === '/login' && currentUser.value) {
    return '/my-orders'
  }

  // Restrict access to admin panel if user does not have admin role
  if (requiresAdmin && !isAdmin.value) {
    return '/my-orders'
  }
})

export default router
