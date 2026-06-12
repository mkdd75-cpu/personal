<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'
import AppointmentModal from '@/components/AppointmentModal.vue'
import RatingModal from '@/components/RatingModal.vue'
import MedicalRecordModal from '@/components/MedicalRecordModal.vue'

const router = useRouter()
const userStore = useUserStore()

const term = ref('')
const rawResults = ref([])
const loading = ref(false)
const error = ref('')
const hasSearched = ref(false)

// Filters & sort
const roleFilter = ref('all')          // all | doctor | preceptor | patient
const specFilter = ref('all')          // all | <specialization>
const sortBy = ref('relevance')        // relevance | rating | name

const selectedUser = ref(null)
const showAppointment = ref(false)
const showRating = ref(false)
const showRecord = ref(false)

const myId = computed(() => userStore.user?._id)
const role = computed(() => userStore.user?.role)
const isStaff = computed(() => ['doctor', 'preceptor', 'admin'].includes(role.value))

let debounceTimer = null

watch(term, (val) => {
  clearTimeout(debounceTimer)
  if (val.trim().length === 0) { rawResults.value = []; hasSearched.value = false; return }
  debounceTimer = setTimeout(runSearch, 300)
})

async function runSearch() {
  error.value = ''
  loading.value = true
  hasSearched.value = true
  try {
    const url = new URL(apiUrl('/users'))
    if (term.value.trim()) url.searchParams.set('q', term.value.trim())
    const res = await userStore.apiFetch(url.toString())
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Search failed') }
    rawResults.value = await res.json()
  } catch (err) {
    error.value = err.message
    rawResults.value = []
  } finally {
    loading.value = false
  }
}

async function showAll() {
  term.value = ''
  clearTimeout(debounceTimer)
  await runSearch()
}

// Exclude yourself from every result set
const visibleBase = computed(() => rawResults.value.filter(u => u._id !== myId.value))

// Available specializations (from current results) for the dropdown
const specializations = computed(() => {
  const set = new Set()
  visibleBase.value.forEach(u => { if (u.specialization) set.add(u.specialization) })
  return [...set].sort()
})

// Available roles in results (so we don't show a filter that returns nothing)
const availableRoles = computed(() => {
  const set = new Set(visibleBase.value.map(u => u.role))
  return [...set]
})

function avgRating(u) {
  const r = u.ratings || []
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0
}

// Apply filters + sort client-side
const results = computed(() => {
  let list = [...visibleBase.value]

  if (roleFilter.value !== 'all') list = list.filter(u => u.role === roleFilter.value)
  if (specFilter.value !== 'all') list = list.filter(u => u.specialization === specFilter.value)

  if (sortBy.value === 'rating') {
    list.sort((a, b) => avgRating(b) - avgRating(a))
  } else if (sortBy.value === 'name') {
    list.sort((a, b) => (a.firstname || '').localeCompare(b.firstname || ''))
  }
  // 'relevance' keeps the server order (specialization then rating)

  return list
})

function avg(u) {
  const r = u.ratings || []
  return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : null
}

function messageUser(u) {
  if (u._id === myId.value) return       // never chat with yourself
  router.push(`/message/${u._id}`)
}
function bookWith(u) { selectedUser.value = u; showAppointment.value = true }
function rateUser(u) { selectedUser.value = u; showRating.value = true }
function openRecord(u) { selectedUser.value = u; showRecord.value = true }
function initials(u) { return ((u.firstname?.[0] || '') + (u.lastname?.[0] || '')).toUpperCase() }

function resetFilters() {
  roleFilter.value = 'all'
  specFilter.value = 'all'
  sortBy.value = 'relevance'
}
</script>

<template>
  <div class="search-view">
    <div class="search-head">
      <h2>Find Users</h2>
      <p class="search-sub">
        {{ role === 'patient'
          ? 'Search for doctors and preceptors by name, email, or specialization.'
          : 'Search for any user by name or email.' }}
      </p>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <span class="material-symbols-outlined search-icon">search</span>
      <input v-model="term" type="text" placeholder="Start typing a name or email…" @keyup.enter="runSearch" />
      <button class="btn btn-primary" @click="showAll">Show All</button>
    </div>

    <!-- Filters & sort -->
    <div v-if="visibleBase.length" class="controls">
      <div class="control">
        <label>Role</label>
        <select v-model="roleFilter">
          <option value="all">All roles</option>
          <option v-for="r in availableRoles" :key="r" :value="r">{{ r.charAt(0).toUpperCase() + r.slice(1) }}s</option>
        </select>
      </div>

      <div class="control" v-if="specializations.length">
        <label>Specialization</label>
        <select v-model="specFilter">
          <option value="all">All specializations</option>
          <option v-for="s in specializations" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div class="control">
        <label>Sort by</label>
        <select v-model="sortBy">
          <option value="relevance">Relevance</option>
          <option value="rating">Highest rated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      <button
        v-if="roleFilter !== 'all' || specFilter !== 'all' || sortBy !== 'relevance'"
        class="reset-btn" @click="resetFilters"
      >
        <span class="material-symbols-outlined">restart_alt</span> Reset
      </button>
    </div>

    <div v-if="error" class="alert alert-error mt-2">{{ error }}</div>

    <div v-if="hasSearched && !loading" class="result-count">
      {{ results.length }} {{ results.length === 1 ? 'result' : 'results' }}
    </div>

    <div v-if="loading" class="status">Searching…</div>

    <!-- Results -->
    <div class="results">
      <div v-for="u in results" :key="u._id" class="user-card">
        <div class="user-main">
          <div class="user-avatar">{{ initials(u) }}</div>
          <div class="user-info">
            <span class="user-name">{{ u.firstname }} {{ u.lastname }}</span>
            <div class="user-tags">
              <span class="role-badge" :class="`role-${u.role}`">{{ u.role }}</span>
              <span v-if="u.specialization" class="spec">{{ u.specialization }}</span>
            </div>
            <div class="user-meta">
              <span class="email">{{ u.email }}</span>
              <span v-if="avg(u)" class="rating">
                <span class="material-symbols-outlined star">star</span>{{ avg(u) }}
                <span class="rating-count">({{ u.ratings.length }})</span>
              </span>
            </div>
          </div>
        </div>

        <div class="user-actions">
          <button class="act-btn" @click="messageUser(u)" title="Message">
            <span class="material-symbols-outlined">chat</span>
          </button>
          <template v-if="role === 'patient' && (u.role === 'doctor' || u.role === 'preceptor')">
            <button class="act-btn primary" @click="bookWith(u)" title="Book appointment">
              <span class="material-symbols-outlined">calendar_add_on</span>
            </button>
            <button class="act-btn" @click="rateUser(u)" title="Leave a review">
              <span class="material-symbols-outlined">star</span>
            </button>
          </template>
          <template v-if="isStaff && u.role === 'patient'">
            <button class="act-btn primary" @click="bookWith(u)" title="Schedule appointment">
              <span class="material-symbols-outlined">calendar_add_on</span>
            </button>
            <button class="act-btn record" @click="openRecord(u)" title="Medical record">
              <span class="material-symbols-outlined">clinical_notes</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="hasSearched && !loading && results.length === 0 && !error" class="empty">
      <span class="material-symbols-outlined">search_off</span>
      <p>No users found</p>
    </div>

    <AppointmentModal v-model="showAppointment" :target="selectedUser" />
    <RatingModal v-model="showRating" :target="selectedUser" />
    <MedicalRecordModal v-model="showRecord" :patient="selectedUser" />
  </div>
</template>

<style scoped>
.search-view { padding: 1.5rem; max-width: 820px; margin: 0 auto; }
.search-head { margin-bottom: 1.2rem; }
.search-sub { color: var(--gray-500); font-size: 0.9rem; margin-top: 2px; }

.search-bar { display: flex; align-items: center; gap: 10px; background: var(--white); border: 1.5px solid var(--gray-200); border-radius: var(--radius-md); padding: 6px 6px 6px 14px; box-shadow: var(--shadow-sm); }
.search-bar:focus-within { border-color: var(--green); box-shadow: 0 0 0 3px rgba(48,135,108,.12); }
.search-icon { color: var(--gray-400); font-size: 22px; }
.search-bar input { border: none; box-shadow: none; flex: 1; padding: 0.5rem 0; font-size: 0.98rem; }
.search-bar input:focus { box-shadow: none; }

.controls { display: flex; align-items: flex-end; gap: 0.8rem; margin-top: 1rem; flex-wrap: wrap; }
.control { display: flex; flex-direction: column; gap: 3px; }
.control label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500); }
.control select { padding: 0.45rem 0.7rem; font-size: 0.88rem; min-width: 140px; }
.reset-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--green); font-size: 0.82rem; font-weight: 600; cursor: pointer; padding: 0.5rem 0; }
.reset-btn .material-symbols-outlined { font-size: 16px; }

.result-count { font-size: 0.82rem; color: var(--gray-500); margin: 1rem 0 0.6rem; font-weight: 600; }
.status { padding: 1.5rem; text-align: center; color: var(--gray-500); }

.results { display: flex; flex-direction: column; gap: 0.7rem; }
.user-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; transition: border-color 0.18s, box-shadow 0.18s; }
.user-card:hover { border-color: var(--green-200); box-shadow: var(--shadow-sm); }
.user-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.user-avatar { width: 46px; height: 46px; border-radius: 50%; background: var(--green-100); color: var(--green-800); font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.user-info { min-width: 0; }
.user-name { font-size: 0.98rem; font-weight: 600; color: var(--gray-900); }
.user-tags { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
.role-badge { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.03em; }
.role-doctor { background: var(--green-100); color: var(--green-800); }
.role-preceptor { background: #e7e0fb; color: #5b3fa3; }
.role-patient { background: var(--gray-200); color: var(--gray-700); }
.role-admin { background: #ffe7d1; color: #9a5418; }
.spec { font-size: 0.8rem; color: var(--gray-600); }
.user-meta { display: flex; align-items: center; gap: 12px; }
.email { font-size: 0.8rem; color: var(--gray-400); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.rating { display: inline-flex; align-items: center; gap: 2px; font-size: 0.82rem; font-weight: 600; color: #c98a00; }
.rating .star { font-size: 15px; font-variation-settings: 'FILL' 1; }
.rating-count { color: var(--gray-400); font-weight: 400; }

.user-actions { display: flex; gap: 6px; flex-shrink: 0; }
.act-btn { width: 38px; height: 38px; border-radius: 10px; border: 1.5px solid var(--gray-200); background: var(--white); color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.act-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-50); }
.act-btn .material-symbols-outlined { font-size: 20px; }
.act-btn.primary { background: var(--green); border-color: var(--green); color: var(--white); }
.act-btn.primary:hover { background: var(--green-700); }
.act-btn.record { background: var(--green-50); border-color: var(--green-200); color: var(--green-800); }
.act-btn.record:hover { background: var(--green); color: var(--white); }

.empty { text-align: center; padding: 3rem 1rem; color: var(--gray-400); }
.empty .material-symbols-outlined { font-size: 48px; }
.empty p { font-size: 1rem; margin-top: 0.5rem; }
.mt-2 { margin-top: 0.8rem; }

@media (max-width: 600px) {
  .user-card { flex-direction: column; align-items: stretch; }
  .user-actions { justify-content: flex-end; }
  .email { max-width: 140px; }
  .control select { min-width: 120px; }
}
</style>