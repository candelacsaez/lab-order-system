<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'vue-router'

const router = useRouter()
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Compute today's date in YYYY-MM-DD for min date attribute
const todayDate = computed(() => {
  const d = new Date()
  return d.toISOString().split('T')[0]
})

const form = reactive({
  item_name: '',
  provider_url: '',
  needed_by: '',
  category: '',
  quantity: 1,
  unit: 'Units (pcs)',
  notes: ''
})

const sanitizeUrl = (url: string) => {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

const submitOrder = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  const currentUser = auth.currentUser
  if (!currentUser) {
    errorMessage.value = 'You must be signed in to submit an order request.'
    return
  }

  if (form.quantity < 1) {
    errorMessage.value = 'Quantity must be at least 1.'
    return
  }

  isSubmitting.value = true
  try {
    const finalUrl = sanitizeUrl(form.provider_url)

    await addDoc(collection(db, 'orders'), {
      item_name: form.item_name.trim(),
      provider_url: finalUrl,
      needed_by: form.needed_by,
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      notes: form.notes?.trim() || '',
      status: 'pending', // pending, approved, ordered, delivered, rejected
      created_at: serverTimestamp(),
      user_uid: currentUser.uid,
      user_email: currentUser.email || 'unknown'
    })

    successMessage.value = 'Order submitted successfully! Redirecting to your orders list...'
    setTimeout(() => {
      router.push('/my-orders')
    }, 1200)
  } catch (error: any) {
    console.error('Error saving order:', error)
    errorMessage.value = 'An error occurred while submitting your order. Please check your connection and try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="order-page">
    <div class="order-card">
      <div class="card-header">
        <div class="header-icon">📦</div>
        <div>
          <h2>Request Lab Materials</h2>
          <p class="header-subtitle">Enter the details of the reagent or equipment needed for your research</p>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-error">
        <span>⚠️ {{ errorMessage }}</span>
      </div>

      <div v-if="successMessage" class="alert alert-success">
        <span>✅ {{ successMessage }}</span>
      </div>

      <form @submit.prevent="submitOrder" class="order-form">
        <div class="form-group">
          <label for="item_name">Product / Reagent Name *</label>
          <input
            id="item_name"
            type="text"
            v-model="form.item_name"
            required
            placeholder="e.g. ESP32-S3 Microcontroller, Milli-Q Water 5L, Acetone 99.8%..."
          />
        </div>

        <div class="form-group">
          <label for="provider_url">Supplier Link or Product URL *</label>
          <input
            id="provider_url"
            type="text"
            v-model="form.provider_url"
            required
            placeholder="https://es.farnell.com/... or https://amazon.com/..."
          />
          <span class="field-hint">Paste the exact link where purchasing staff can acquire this item.</span>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="category">Category *</label>
            <select id="category" v-model="form.category" required>
              <option value="" disabled>Select a category</option>
              <option value="Electronics">Electronics / Hardware</option>
              <option value="Chemicals">Chemical Reagents</option>
              <option value="Biolab">Biolab / Cell Culture</option>
              <option value="Biomaterials">Biomaterials</option>
              <option value="Consumables">Consumables / Labware</option>
              <option value="Other">Other Materials</option>
            </select>
          </div>

          <div class="form-group flex-1">
            <label for="needed_by">Required By Date *</label>
            <input
              id="needed_by"
              type="date"
              v-model="form.needed_by"
              :min="todayDate"
              required
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="quantity">Quantity *</label>
            <input
              id="quantity"
              type="number"
              min="1"
              step="any"
              v-model.number="form.quantity"
              required
            />
          </div>

          <div class="form-group flex-1">
            <label for="unit">Unit of Measure *</label>
            <select id="unit" v-model="form.unit" required>
              <option value="Units (pcs)">Units (pcs)</option>
              <option value="L">Liters (L)</option>
              <option value="mL">Milliliters (mL)</option>
              <option value="g">Grams (g)</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="Boxes">Boxes / Packs</option>
              <option value="Bottles">Bottles</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Project Notes or Justification (optional)</label>
          <textarea
            id="notes"
            v-model="form.notes"
            rows="3"
            placeholder="Specify grant/project code, urgency reason, or special handling specifications..."
          ></textarea>
        </div>

        <div class="form-actions">
          <router-link to="/my-orders" class="btn-cancel">
            Cancel
          </router-link>

          <button type="submit" class="btn-submit" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="spinner"></span>
            <span>{{ isSubmitting ? 'Submitting order...' : 'Submit Order' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.order-page {
  max-width: 760px;
  margin: 0 auto;
}

.order-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  padding: 2rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.75rem;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1.25rem;
}

.header-icon {
  font-size: 2rem;
  background: #eff6ff;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.card-header h2 {
  font-size: 1.35rem;
  color: #0f172a;
  font-weight: 700;
}

.header-subtitle {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.2rem;
}

.order-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.flex-1 {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.field-hint {
  font-size: 0.775rem;
  color: #64748b;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.75rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.925rem;
  color: #0f172a;
  background: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.alert-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

.btn-cancel {
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  text-decoration: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.15s;
}

.btn-cancel:hover {
  background: #f8fafc;
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-submit:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
