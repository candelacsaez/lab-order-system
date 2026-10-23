<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { db, auth } from '../firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  type Unsubscribe
} from 'firebase/firestore'

interface Order {
  id: string
  item_name: string
  provider_url: string
  category: string
  quantity: number
  unit: string
  needed_by: string
  status: 'pending' | 'approved' | 'ordered' | 'delivered' | 'rejected'
  created_at: any
  notes?: string
  user_email?: string
}

const orders = ref<Order[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedStatus = ref<string>('all')
const actionLoadingId = ref<string | null>(null)
let unsubscribeSnapshot: Unsubscribe | null = null

const statusMap: Record<string, { label: string; colorClass: string }> = {
  pending: { label: 'Pending', colorClass: 'badge-pending' },
  approved: { label: 'Approved', colorClass: 'badge-approved' },
  ordered: { label: 'Ordered', colorClass: 'badge-ordered' },
  delivered: { label: 'Delivered', colorClass: 'badge-delivered' },
  rejected: { label: 'Rejected', colorClass: 'badge-rejected' }
}

const getStatusBadge = (status: string) => {
  return statusMap[status] || { label: status?.toUpperCase() || 'UNKNOWN', colorClass: 'badge-default' }
}

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'Recent'
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString('en-US')
  }
  return 'Recent'
}

const subscribeOrders = () => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    loading.value = false
    return
  }

  loading.value = true
  const q = query(
    collection(db, 'orders'),
    where('user_uid', '==', currentUser.uid)
  )

  unsubscribeSnapshot = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Order[]

      // Sort client-side safely by created_at desc (newest first)
      items.sort((a, b) => {
        const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : Date.now()
        const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : Date.now()
        return timeB - timeA
      })

      orders.value = items
      loading.value = false
    },
    (error) => {
      console.error('Error listening to user orders:', error)
      loading.value = false
    }
  )
}

const cancelOrder = async (orderId: string) => {
  if (!confirm('Are you sure you want to cancel this request?')) return
  actionLoadingId.value = orderId
  try {
    await deleteDoc(doc(db, 'orders', orderId))
  } catch (err) {
    console.error('Error canceling order:', err)
    alert('Could not cancel the order request.')
  } finally {
    actionLoadingId.value = null
  }
}

const filteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const matchesStatus =
      selectedStatus.value === 'all' || order.status === selectedStatus.value

    const queryText = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !queryText ||
      order.item_name?.toLowerCase().includes(queryText) ||
      order.category?.toLowerCase().includes(queryText)

    return matchesStatus && matchesSearch
  })
})

onMounted(() => {
  subscribeOrders()
})

onUnmounted(() => {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot()
  }
})
</script>

<template>
  <div class="orders-page">
    <div class="page-topbar">
      <div>
        <h1 class="page-title">My Material Requests</h1>
        <p class="page-desc">Real-time status and history of your research procurement orders</p>
      </div>

      <router-link to="/create-order" class="btn-primary">
        <span>➕</span> Request Materials
      </router-link>
    </div>

    <div class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search by product or category..."
        />
      </div>

      <div class="status-filters">
        <button
          type="button"
          :class="['filter-chip', { active: selectedStatus === 'all' }]"
          @click="selectedStatus = 'all'"
        >
          All ({{ orders.length }})
        </button>
        <button
          type="button"
          :class="['filter-chip', { active: selectedStatus === 'pending' }]"
          @click="selectedStatus = 'pending'"
        >
          Pending ({{ orders.filter(o => o.status === 'pending').length }})
        </button>
        <button
          type="button"
          :class="['filter-chip', { active: selectedStatus === 'approved' }]"
          @click="selectedStatus = 'approved'"
        >
          Approved
        </button>
        <button
          type="button"
          :class="['filter-chip', { active: selectedStatus === 'ordered' }]"
          @click="selectedStatus = 'ordered'"
        >
          Ordered
        </button>
        <button
          type="button"
          :class="['filter-chip', { active: selectedStatus === 'delivered' }]"
          @click="selectedStatus = 'delivered'"
        >
          Delivered
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="state-card">
      <div class="spinner-large"></div>
      <p>Loading your requests in real-time...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="orders.length === 0" class="state-card empty-state">
      <div class="empty-icon">📋</div>
      <h3>No material requests yet</h3>
      <p>Submit your first order request so the laboratory staff can manage it.</p>
      <router-link to="/create-order" class="btn-primary" style="margin-top: 1rem;">
        ➕ Submit my first order
      </router-link>
    </div>

    <!-- Filtered Empty -->
    <div v-else-if="filteredOrders.length === 0" class="state-card empty-state">
      <div class="empty-icon">🔎</div>
      <h3>No matching requests found</h3>
      <p>No orders match the selected filter or search term.</p>
      <button class="btn-secondary" @click="searchQuery = ''; selectedStatus = 'all'">
        Reset filters
      </button>
    </div>

    <!-- Table -->
    <div v-else class="table-container">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Material / Product</th>
            <th>Quantity</th>
            <th>Category</th>
            <th>Request Date</th>
            <th>Required By</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.id">
            <td class="cell-product">
              <a
                :href="order.provider_url"
                target="_blank"
                rel="noopener noreferrer"
                class="product-link"
                title="Open supplier link"
              >
                <span>{{ order.item_name }}</span>
                <span class="external-icon">↗</span>
              </a>
              <span v-if="order.notes" class="product-notes">{{ order.notes }}</span>
            </td>
            <td>
              <strong>{{ order.quantity }}</strong> {{ order.unit }}
            </td>
            <td>
              <span class="category-tag">{{ order.category }}</span>
            </td>
            <td class="cell-date">
              {{ formatDate(order.created_at) }}
            </td>
            <td class="cell-date">
              {{ order.needed_by }}
            </td>
            <td>
              <span :class="['status-badge', getStatusBadge(order.status).colorClass]">
                {{ getStatusBadge(order.status).label }}
              </span>
            </td>
            <td>
              <button
                v-if="order.status === 'pending'"
                type="button"
                class="btn-cancel-order"
                @click="cancelOrder(order.id)"
                :disabled="actionLoadingId === order.id"
                title="Cancel request"
              >
                {{ actionLoadingId === order.id ? '...' : 'Cancel' }}
              </button>
              <span v-else class="text-locked">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.orders-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #0f172a;
}

.page-desc {
  color: #64748b;
  font-size: 0.9rem;
  margin-top: 0.2rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #2563eb;
  color: white;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  transition: background-color 0.15s;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  color: #334155;
}

.btn-secondary:hover {
  background: #f1f5f9;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #ffffff;
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  color: #94a3b8;
}

.search-box input {
  width: 100%;
  padding: 0.55rem 0.75rem 0.55rem 2.2rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
}

.search-box input:focus {
  border-color: #2563eb;
}

.status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.filter-chip {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 0.4rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}

.filter-chip:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.filter-chip.active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
  font-weight: 600;
}

.state-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 3.5rem 2rem;
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.empty-state h3 {
  color: #0f172a;
  font-size: 1.15rem;
}

.spinner-large {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.orders-table th {
  background: #f8fafc;
  padding: 0.85rem 1rem;
  font-weight: 600;
  color: #475569;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}

.orders-table td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: middle;
}

.orders-table tr:last-child td {
  border-bottom: none;
}

.orders-table tr:hover {
  background: #fafbfd;
}

.cell-product {
  max-width: 260px;
}

.product-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}

.product-link:hover {
  text-decoration: underline;
}

.external-icon {
  font-size: 0.8rem;
  opacity: 0.7;
}

.product-notes {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-tag {
  background: #f1f5f9;
  color: #475569;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.cell-date {
  color: #64748b;
  font-size: 0.85rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge-pending {
  background: #fef3c7;
  color: #92400e;
}

.badge-approved {
  background: #dbeafe;
  color: #1e40af;
}

.badge-ordered {
  background: #f3e8ff;
  color: #6b21a8;
}

.badge-delivered {
  background: #dcfce7;
  color: #15803d;
}

.badge-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.badge-default {
  background: #e2e8f0;
  color: #334155;
}

.btn-cancel-order {
  background: transparent;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-order:hover:not(:disabled) {
  background: #fee2e2;
}

.btn-cancel-order:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-locked {
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
