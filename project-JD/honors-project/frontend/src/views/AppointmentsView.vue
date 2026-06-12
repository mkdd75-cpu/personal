<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()
const appointments = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('upcoming')

const userId = computed(() => userStore.user?._id)
const role = computed(() => userStore.user?.role)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await userStore.apiFetch(apiUrl(`/appointments/${userId.value}`))
    if (!res.ok) throw new Error('Failed to load appointments')
    appointments.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const now = new Date()
  if (filter.value === 'upcoming') {
    return appointments.value.filter(a =>
      ['pending', 'confirmed'].includes(a.status) && new Date(a.scheduledFor) >= new Date(now.toDateString())
    )
  }
  if (filter.value === 'past') {
    return appointments.value.filter(a =>
      a.status === 'completed' || new Date(a.scheduledFor) < now
    )
  }
  return appointments.value
})

async function updateStatus(appt, status) {
  try {
    const res = await userStore.apiFetch(apiUrl(`/appointments/${appt._id}/status`), {
      method: 'PATCH', body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      const idx = appointments.value.findIndex(a => a._id === appt._id)
      if (idx !== -1) appointments.value[idx] = updated
    }
  } catch (err) { console.error(err) }
}

function otherParty(appt) {
  // Show the person who isn't the current user
  if (appt.requester?._id === userId.value) return appt.recipient
  return appt.requester
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function initials(u) {
  return ((u?.firstname?.[0] || '') + (u?.lastname?.[0] || '')).toUpperCase()
}

const isStaff = computed(() => ['doctor', 'preceptor', 'admin'].includes(role.value))
</script>

<template>
  <div class="appts-view">
    <div class="appts-head">
      <h2>Appointments</h2>
      <div class="filter-tabs">
        <button :class="{ active: filter === 'upcoming' }" @click="filter = 'upcoming'">Upcoming</button>
        <button :class="{ active: filter === 'past' }" @click="filter = 'past'">Past</button>
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
      </div>
    </div>

    <div v-if="loading" class="status">Loading appointments…</div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="empty">
      <span class="material-symbols-outlined">event_busy</span>
      <p>No {{ filter }} appointments</p>
    </div>

    <div v-else class="appt-list">
      <div v-for="appt in filtered" :key="appt._id" class="appt-card" :class="`status-${appt.status}`">
        <div class="appt-avatar">{{ initials(otherParty(appt)) }}</div>

        <div class="appt-body">
          <div class="appt-top">
            <span class="appt-name">{{ otherParty(appt)?.firstname }} {{ otherParty(appt)?.lastname }}</span>
            <span class="status-pill" :class="`pill-${appt.status}`">{{ appt.status }}</span>
          </div>
          <p class="appt-reason">{{ appt.reason }}</p>
          <div class="appt-meta">
            <span><span class="material-symbols-outlined">schedule</span>{{ fmtDateTime(appt.scheduledFor) }}</span>
            <span class="visit-type">{{ appt.visitType }}</span>
          </div>

          <!-- Staff can confirm/decline pending requests -->
          <div v-if="appt.status === 'pending' && (appt.recipient?._id === userId || isStaff)" class="appt-actions">
            <button class="btn btn-primary btn-sm" @click="updateStatus(appt, 'confirmed')">Confirm</button>
            <button class="btn btn-ghost btn-sm" @click="updateStatus(appt, 'declined')">Decline</button>
          </div>
          <div v-else-if="appt.status === 'confirmed'" class="appt-actions">
            <button v-if="isStaff" class="btn btn-outline btn-sm" @click="updateStatus(appt, 'completed')">Mark Complete</button>
            <button class="btn btn-ghost btn-sm" @click="updateStatus(appt, 'cancelled')">Cancel</button>
            <button class="btn btn-ghost btn-sm" @click="router.push(`/message/${otherParty(appt)?._id}`)">Message</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.appts-view { padding: 1.5rem; max-width: 720px; margin: 0 auto; }
.appts-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 0.8rem; }
.filter-tabs { display: flex; gap: 4px; background: var(--gray-100); padding: 3px; border-radius: var(--radius-md); }
.filter-tabs button { border: none; background: none; padding: 0.4rem 0.9rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; color: var(--gray-500); cursor: pointer; font-family: var(--font); }
.filter-tabs button.active { background: var(--white); color: var(--green); box-shadow: var(--shadow-sm); }

.status { text-align: center; padding: 2rem; color: var(--gray-500); }
.empty { text-align: center; padding: 3rem 1rem; color: var(--gray-400); }
.empty .material-symbols-outlined { font-size: 48px; }
.empty p { margin-top: 0.5rem; }

.appt-list { display: flex; flex-direction: column; gap: 0.8rem; }
.appt-card { display: flex; gap: 14px; background: var(--white); border: 1px solid var(--gray-200); border-left-width: 4px; border-radius: var(--radius-md); padding: 1rem 1.1rem; }
.status-pending { border-left-color: #e0a317; }
.status-confirmed { border-left-color: var(--green); }
.status-completed { border-left-color: var(--gray-400); }
.status-cancelled, .status-declined { border-left-color: var(--error); opacity: 0.75; }

.appt-avatar { width: 46px; height: 46px; border-radius: 50%; background: var(--green-100); color: var(--green-800); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.appt-body { flex: 1; min-width: 0; }
.appt-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.appt-name { font-size: 1rem; font-weight: 600; color: var(--gray-900); }
.status-pill { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; padding: 2px 9px; border-radius: 10px; }
.pill-pending { background: #fdf0d5; color: #8a5700; }
.pill-confirmed { background: var(--green-100); color: var(--green-800); }
.pill-completed { background: var(--gray-200); color: var(--gray-600); }
.pill-cancelled, .pill-declined { background: var(--error-bg); color: var(--error); }

.appt-reason { font-size: 0.9rem; color: var(--gray-700); margin: 4px 0; }
.appt-meta { display: flex; align-items: center; gap: 12px; font-size: 0.8rem; color: var(--gray-500); }
.appt-meta span { display: inline-flex; align-items: center; gap: 3px; }
.appt-meta .material-symbols-outlined { font-size: 15px; }
.visit-type { background: var(--green-50); color: var(--green-700); padding: 1px 8px; border-radius: 10px; text-transform: capitalize; font-weight: 600; }

.appt-actions { display: flex; gap: 6px; margin-top: 0.7rem; flex-wrap: wrap; }
</style>