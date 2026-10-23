<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { db } from '../firebase'
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  type Unsubscribe
} from 'firebase/firestore'
import { useAuthUser } from '../composables/useAuthUser'

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
  user_email: string
}

const { isAdmin } = useAuthUser()
const orders = ref<Order[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const updatingId = ref<string | null>(null)
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
  return 'Recent'
}

const subscribeAllOrders = () => {
  loading.value = true
  const ordersRef = collection(db, 'orders')

  unsubscribeSnapshot = onSnapshot(
    ordersRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Order[]

      // Sort client-side by created_at desc (newest first)
      items.sort((a, b) => {
        const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : Date.now()
        const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : Date.now()
        return timeB - timeA
      })

      orders.value = items
      loading.value = false
    },
    (err) => {
      console.error('Error listening to all orders:', err)
      loading.value = false
    }
  )
}

const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
  updatingId.value = orderId
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus
    })
  } catch (err) {
    console.error('Error updating order status:', err)
    alert('Failed to update order status.')
  } finally {
    updatingId.value = null
  }
}

// Counts for KPI summary cards
const counts = computed(() => {
  return {
    total: orders.value.length,
    pending: orders.value.filter((o) => o.status === 'pending').length,
    approved: orders.value.filter((o) => o.status === 'approved').length,
    ordered: orders.value.filter((o) => o.status === 'ordered').length,
    delivered: orders.value.filter((o) => o.status === 'delivered').length
  }
})

const filteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const matchesStatus =
      statusFilter.value === 'all' || order.status === statusFilter.value

    const query = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !query ||
      order.item_name?.toLowerCase().includes(query) ||
      order.user_email?.toLowerCase().includes(query) ||
      order.category?.toLowerCase().includes(query)

    return matchesStatus && matchesSearch
  })
})

onMounted(() => {
  subscribeAllOrders()
})

onUnmounted(() => {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot()
  }
})
</script>

<template>
  <div class="admin-page">
    <div v-if="!isAdmin" class="access-denied-card">
      <div class="denied-icon">🔒</div>
      <h2>Access Restricted</h2>
      <p>You need administrator or lab manager privileges to view this section.</p>
      <router-link to="/my-orders" class="btn-primary" style="margin-top: 1rem;">
        Return to My Orders
      </router-link>
    </div>

    <template v-else>
      <div class="admin-topbar">
        <div>
          <h1 class="page-title">⚙️ Lab Management Panel</h1>
          <p class="page-desc">Review, approve, and track material purchases requested by all researchers</p>
        </div>
      </div>

      <!-- KPI Metric Cards -->
      <div class="metrics-grid">
        <div class="metric-card" @click="statusFilter = 'all'">
          <div class="metric-info">
            <span class="metric-num">{{ counts.total }}</span>
            <span class="metric-label">Total Requests</span>
          </div>
          <div class="metric-icon total">📦</div>
        </div>

        <div class="metric-card" @click="statusFilter = 'pending'">
          <div class="metric-info">
            <span class="metric-num text-amber">{{ counts.pending }}</span>
            <span class="metric-label">Pending Approval</span>
          </div>
          <div class="metric-icon pending">⏳</div>
        </div>

        <div class="metric-card" @click="statusFilter = 'approved'">
          <div class="metric-info">
            <span class="metric-num text-blue">{{ counts.approved }}</span>
            <span class="metric-label">Approved (To Buy)</span>
          </div>
          <div class="metric-icon approved">✓</div>
        </div>

        <div class="metric-card" @click="statusFilter = 'ordered'">
          <div class="metric-info">
            <span class="metric-num text-purple">{{ counts.ordered }}</span>
            <span class="metric-label">In Transit / Ordered</span>
          </div>
          <div class="metric-icon ordered">🚚</div>
        </div>

        <div class="metric-card" @click="statusFilter = 'delivered'">
          <div class="metric-info">
            <span class="metric-num text-green">{{ counts.delivered }}</span>
            <span class="metric-label">Delivered</span>
          </div>
          <div class="metric-icon delivered">🎉</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by researcher, product, or category..."
          />
        </div>

        <div class="status-filters">
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'all' }]"
            @click="statusFilter = 'all'"
          >
            All
          </button>
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'pending' }]"
            @click="statusFilter = 'pending'"
          >
            Pending ({{ counts.pending }})
          </button>
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'approved' }]"
            @click="statusFilter = 'approved'"
          >
            Approved
          </button>
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'ordered' }]"
            @click="statusFilter = 'ordered'"
          >
            Ordered
          </button>
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'delivered' }]"
            @click="statusFilter = 'delivered'"
          >
            Delivered
          </button>
          <button
            type="button"
            :class="['filter-chip', { active: statusFilter === 'rejected' }]"
            @click="statusFilter = 'rejected'"
          >
            Rejected
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="state-card">
        <div class="spinner-large"></div>
        <p>Loading all orders...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredOrders.length === 0" class="state-card">
        <div class="empty-icon">📂</div>
        <h3>No matching requests</h3>
        <p>No orders found with the current filters.</p>
      </div>

      <!-- Table -->
      <div v-else class="table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Request Date</th>
              <th>Required</th>
              <th>Status</th>
              <th>Management Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.id">
              <td class="cell-user">
                <span class="user-pill">{{ order.user_email }}</span>
              </td>
              <td class="cell-product">
                <a
                  :href="order.provider_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="product-link"
                >
                  <span>{{ order.item_name }}</span>
                  <span class="external-icon">↗</span>
                </a>
                <div class="meta-row">
                  <span class="category-tag">{{ order.category }}</span>
                  <span v-if="order.notes" class="notes-tooltip" :title="order.notes">📝 Notes</span>
                </div>
              </td>
              <td>
                <strong>{{ order.quantity }}</strong> {{ order.unit }}
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
              <td class="cell-actions">
                <div class="action-buttons">
                  <select
                    class="select-status"
                    :value="order.status"
                    :disabled="updatingId === order.id"
                    @change="updateOrderStatus(order.id, ($event.target as HTMLSelectElement).value as Order['status'])"
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="approved">✓ Approve</option>
                    <option value="ordered">🚚 Mark Ordered</option>
                    <option value="delivered">🎉 Mark Delivered</option>
                    <option value="rejected">✕ Reject</option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.access-denied-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 4rem 2rem;
  text-align: center;
  max-width: 520px;
  margin: 3rem auto;
}

.denied-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.access-denied-card h2 {
  font-size: 1.4rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.access-denied-card p {
  color: #64748b;
  font-size: 0.95rem;
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

.admin-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-num {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
}

.metric-label {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.35rem;
  font-weight: 500;
}

.metric-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.metric-icon.total { background: #f1f5f9; }
.metric-icon.pending { background: #fef3c7; }
.metric-icon.approved { background: #dbeafe; }
.metric-icon.ordered { background: #f3e8ff; }
.metric-icon.delivered { background: #dcfce7; }

.text-amber { color: #d97706; }
.text-blue { color: #2563eb; }
.text-purple { color: #9333ea; }
.text-green { color: #16a34a; }

/* Filter Bar */
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
  min-width: 280px;
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

/* Table */
.table-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.admin-table th {
  background: #f8fafc;
  padding: 0.85rem 1rem;
  font-weight: 600;
  color: #475569;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}

.admin-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: middle;
}

.admin-table tr:hover {
  background: #fafbfd;
}

.cell-user {
  max-width: 180px;
}

.user-pill {
  background: #f1f5f9;
  color: #334155;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cell-product {
  max-width: 250px;
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

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.category-tag {
  background: #f1f5f9;
  color: #475569;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.notes-tooltip {
  font-size: 0.75rem;
  color: #64748b;
  cursor: help;
  background: #f8fafc;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  border: 1px dashed #cbd5e1;
}

.cell-date {
  color: #64748b;
  font-size: 0.85rem;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-pending { background: #fef3c7; color: #92400e; }
.badge-approved { background: #dbeafe; color: #1e40af; }
.badge-ordered { background: #f3e8ff; color: #6b21a8; }
.badge-delivered { background: #dcfce7; color: #15803d; }
.badge-rejected { background: #fee2e2; color: #991b1b; }
.badge-default { background: #e2e8f0; color: #334155; }

.select-status {
  padding: 0.35rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  font-size: 0.825rem;
  font-weight: 500;
  color: #0f172a;
  cursor: pointer;
  outline: none;
}

.select-status:focus {
  border-color: #2563eb;
}

.select-status:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style>
