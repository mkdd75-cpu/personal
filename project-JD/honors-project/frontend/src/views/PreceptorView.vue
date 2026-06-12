<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const router = useRouter()
const user = computed(() => userStore.user || {})

const fullName = computed(() =>
  [user.value.firstname, user.value.middlename, user.value.lastname].filter(Boolean).join(' ')
)

const encounters = ref([])
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')

const form = ref({ name: '', type: '', date: '', reason: '', who: '' })

const visitTypes = ['screening', 'acute', 'follow-up', 'counseling']

onMounted(async () => {
  try {
    const res = await userStore.apiFetch(apiUrl(`/encounter/${user.value._id}`))
    if (res.ok) encounters.value = await res.json()
  } catch (err) {
    console.error('Encounters load error:', err)
  }
})

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const averageRating = computed(() => {
  const r = user.value.ratings || []
  if (!r.length) return null
  return (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1)
})

async function submitEncounter() {
  if (!form.value.name || !form.value.type || !form.value.date || !form.value.reason) {
    formError.value = 'Please fill in all required fields.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const res = await userStore.apiFetch(apiUrl(`/encounter/${user.value._id}`), {
      method: 'POST',
      body: JSON.stringify({
        name: form.value.name,
        type: form.value.type,
        date: form.value.date,
        reason: form.value.reason,
        who: form.value.who,
      }),
    })
    if (!res.ok) throw new Error('Failed to create encounter')
    const updated = await userStore.apiFetch(apiUrl(`/encounter/${user.value._id}`))
    if (updated.ok) encounters.value = await updated.json()
    form.value = { name: '', type: '', date: '', reason: '', who: '' }
    showForm.value = false
  } catch (err) {
    formError.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="dashboard">
    <div class="profile-banner">
      <div class="avatar">{{ user.firstname?.charAt(0) }}{{ user.lastname?.charAt(0) }}</div>
      <div>
        <h2 class="banner-name">{{ fullName }}</h2>
        <span class="badge badge-green">Preceptor</span>
      </div>
      <button class="btn btn-outline btn-sm ml-auto" @click="router.push({ name: 'profile' })">
        <span class="material-symbols-outlined">edit</span> Edit Profile
      </button>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-header"><h3>Personal Information</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Full Name</span><span class="field-value">{{ fullName || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Email</span><span class="field-value">{{ user.email || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Phone</span><span class="field-value">{{ user.phone || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Gender</span><span class="field-value">{{ user.gender || '—' }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Professional Information</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Cohort</span><span class="field-value">{{ user.cohort || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Specialization</span><span class="field-value">{{ user.specialization || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Student Doctors</span><span class="field-value">{{ user.patients?.length || 0 }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Ratings</h3></div>
        <div class="card-body">
          <div v-if="averageRating" class="rating-row">
            <span class="rating-num">{{ averageRating }}</span>
            <span class="text-muted">/ 5.0</span>
          </div>
          <p v-else class="text-muted" style="font-size:.9rem">No ratings yet</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Quick Actions</h3></div>
        <div class="card-body actions-col">
          <button class="action-btn" @click="router.push({ name: 'search' })">
            <span class="material-symbols-outlined">search</span>Search Users
          </button>
          <button class="action-btn" @click="router.push(`/mymessages/${user._id}`)">
            <span class="material-symbols-outlined">forum</span>My Messages
          </button>
        </div>
      </div>

      <!-- Encounters -->
      <div class="card span-2">
        <div class="card-header">
          <h3>Encounters</h3>
          <button class="btn btn-primary btn-sm" @click="showForm = !showForm">
            <span class="material-symbols-outlined" style="font-size:16px">{{ showForm ? 'close' : 'add' }}</span>
            {{ showForm ? 'Cancel' : 'New Encounter' }}
          </button>
        </div>

        <div v-if="showForm" class="card-body encounter-form">
          <div v-if="formError" class="alert alert-error mb-2">{{ formError }}</div>
          <div class="form-grid">
            <label class="form-field">
              Patient Name *
              <input v-model="form.name" type="text" placeholder="Patient full name" />
            </label>
            <label class="form-field">
              Visit Type *
              <select v-model="form.type">
                <option value="">Select type</option>
                <option v-for="t in visitTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
              </select>
            </label>
            <label class="form-field">
              Visit Date *
              <input v-model="form.date" type="date" />
            </label>
            <label class="form-field">
              Reason *
              <input v-model="form.reason" type="text" placeholder="Reason for visit" />
            </label>
            <label class="form-field span-2">
              Appointment With (User ID)
              <input v-model="form.who" type="text" placeholder="Patient user ID" />
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="submitEncounter" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save Encounter' }}
            </button>
          </div>
        </div>

        <div class="card-body">
          <div v-if="encounters.length === 0" class="text-muted" style="font-size:.9rem">No encounters recorded yet.</div>
          <div v-for="enc in encounters" :key="enc._id" class="encounter-card">
            <div class="enc-type">{{ enc.visitType }}</div>
            <div class="enc-details">
              <span class="enc-date">{{ formatDate(enc.visitDate) }}</span>
              <span class="enc-reason">{{ enc.reason }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { padding: 1.5rem; }
.profile-banner { display: flex; align-items: center; gap: 1rem; padding: 1.2rem 1.5rem; background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--green-100); margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); }
.avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--green); color: var(--white); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner-name { font-size: 1.15rem; color: var(--gray-900); margin-bottom: 3px; }
.ml-auto { margin-left: auto; }
.mb-2 { margin-bottom: 0.75rem; }
.dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.span-2 { grid-column: 1 / -1; }
.rating-row { display: flex; align-items: baseline; gap: 6px; }
.rating-num { font-size: 2rem; font-weight: 700; color: var(--green); }
.actions-col { display: flex; flex-direction: column; gap: 0.6rem; }
.action-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: .75rem 1rem; border: 1.5px solid var(--green-200); border-radius: var(--radius-md); background: var(--green-50); color: var(--green-800); font-size: .9rem; font-weight: 600; cursor: pointer; transition: all .18s; font-family: var(--font); }
.action-btn:hover { background: var(--green); color: var(--white); border-color: var(--green); }
.action-btn .material-symbols-outlined { font-size: 20px !important; }

.encounter-form { border-bottom: 1px solid var(--gray-200); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
.form-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; font-weight: 600; color: var(--gray-600); }
.span-2 { grid-column: 1 / -1; }
.form-actions { margin-top: 1rem; }

.encounter-card { display: flex; align-items: center; gap: 12px; padding: 0.7rem 0; border-bottom: 1px solid var(--gray-100); }
.encounter-card:last-child { border-bottom: none; }
.enc-type { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: var(--green-100); color: var(--green-800); padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
.enc-details { display: flex; flex-direction: column; }
.enc-date { font-size: 0.82rem; color: var(--gray-500); }
.enc-reason { font-size: 0.9rem; color: var(--gray-800); }
</style>