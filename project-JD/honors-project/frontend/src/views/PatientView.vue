<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/counter'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api.js'
import HealthCardModal from '@/components/HealthCardModal.vue'

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const router = useRouter()

const record = ref(null)
const recordLoading = ref(true)
const showHealthCard = ref(false)

const fullName = computed(() =>
  [user.value?.firstname, user.value?.middlename, user.value?.lastname].filter(Boolean).join(' ')
)

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5))
}

const hasValue = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

onMounted(async () => {
  try {
    const res = await userStore.apiFetch(apiUrl('/my-record'))
    if (res.ok) record.value = await res.json()
  } catch (err) {
    console.error(err)
  } finally {
    recordLoading.value = false
  }
})

const history = computed(() => record.value?.medicalHistory || {})

const latestVitals = computed(() => {
  const vitals = record.value?.vitals || []
  const byType = {}
  for (const v of vitals) {
    if (!byType[v.type] || new Date(v.timestamp) > new Date(byType[v.type].timestamp)) byType[v.type] = v
  }
  return byType
})

const vitalLabels = { bloodPressure: 'Blood Pressure', bloodGlucose: 'Blood Glucose', weight: 'Weight', height: 'Height', BMI: 'BMI' }
const vitalIcons  = { bloodPressure: 'cardiology', bloodGlucose: 'water_drop', weight: 'scale', height: 'height', BMI: 'monitor_weight' }

const recentEncounters = computed(() => (record.value?.encounters || []).slice(0, 3))

const addressLine = computed(() => {
  const a = user.value?.address || {}
  return [a.street, a.city, a.stateOrRegion].filter(Boolean).join(', ')
})

// Count how many health data points exist, for the snapshot ring
const healthScore = computed(() => {
  let filled = 0, total = 5
  if (Object.keys(latestVitals.value).length) filled++
  if (hasValue(history.value.chronicConditions)) filled++
  if (hasValue(history.value.allergies)) filled++
  if (user.value?.emergencyContact?.name) filled++
  if (user.value?.nhisStatus?.isActive) filled++
  return { filled, total, pct: Math.round((filled / total) * 100) }
})
</script>

<template>
  <div class="dashboard">
    <!-- Banner -->
    <div class="profile-banner">
      <div class="avatar">{{ user?.firstname?.charAt(0) }}{{ user?.lastname?.charAt(0) }}</div>
      <div class="banner-text">
        <h2 class="banner-name">{{ fullName }}</h2>
        <div class="banner-meta">
          <span class="badge badge-green">Patient</span>
          <span v-if="age(user?.dob)" class="meta-dot">{{ age(user?.dob) }} years</span>
          <span v-if="user?.gender" class="meta-dot">{{ user?.gender }}</span>
        </div>
      </div>
      <button class="health-card-btn" @click="showHealthCard = true">
        <span class="material-symbols-outlined">badge</span>
        <span class="hcb-text">
          <strong>Health Card</strong>
          <small>Tap for visit & emergency info</small>
        </span>
        <span class="material-symbols-outlined hcb-arrow">chevron_right</span>
      </button>
    </div>

    <div class="dash-grid">
      <!-- Latest Vitals (graphical) -->
      <div class="card vitals-card" v-if="Object.keys(latestVitals).length">
        <div class="card-header"><h3>Latest Vitals</h3></div>
        <div class="card-body vitals-body">
          <div v-for="(v, type) in latestVitals" :key="type" class="vital-tile">
            <span class="material-symbols-outlined vital-icon">{{ vitalIcons[type] || 'monitor_heart' }}</span>
            <span class="vital-num">{{ v.value }}</span>
            <span class="vital-name">{{ vitalLabels[type] || type }}</span>
          </div>
        </div>
      </div>

      <!-- Health completeness ring -->
      <div class="card snapshot-card">
        <div class="card-header"><h3>Health Profile</h3></div>
        <div class="card-body snapshot-body">
          <div class="ring" :style="{ '--pct': healthScore.pct }">
            <div class="ring-center">
              <span class="ring-num">{{ healthScore.filled }}/{{ healthScore.total }}</span>
              <span class="ring-label">complete</span>
            </div>
          </div>
          <p class="snapshot-hint">
            {{ healthScore.pct === 100
              ? 'Your health profile is complete.'
              : 'Visit the clinic to complete your health profile.' }}
          </p>
        </div>
      </div>

      <!-- Allergies (critical) — only if present -->
      <div class="card alert-card" v-if="hasValue(history.allergies)">
        <div class="card-header"><h3 class="critical-h">⚠ Allergies</h3></div>
        <div class="card-body">
          <div class="chip-row">
            <span v-for="a in history.allergies" :key="a" class="chip chip-red">{{ a }}</span>
          </div>
        </div>
      </div>

      <!-- Conditions — only if present -->
      <div class="card" v-if="hasValue(history.chronicConditions)">
        <div class="card-header"><h3>Conditions</h3></div>
        <div class="card-body">
          <div class="chip-row">
            <span v-for="c in history.chronicConditions" :key="c" class="chip">{{ c }}</span>
          </div>
        </div>
      </div>

      <!-- Personal info — always available -->
      <div class="card">
        <div class="card-header"><h3>Personal Information</h3></div>
        <div class="card-body">
          <div class="field-row" v-if="user?.email"><span class="field-label">Email</span><span class="field-value">{{ user.email }}</span></div>
          <div class="field-row" v-if="user?.phone"><span class="field-label">Phone</span><span class="field-value">{{ user.phone }}</span></div>
          <div class="field-row" v-if="user?.dob"><span class="field-label">Date of Birth</span><span class="field-value">{{ formatDate(user.dob) }}</span></div>
          <div class="field-row" v-if="addressLine"><span class="field-label">Address</span><span class="field-value">{{ addressLine }}</span></div>
        </div>
      </div>

      <!-- Emergency contact — only if present -->
      <div class="card" v-if="user?.emergencyContact?.name">
        <div class="card-header"><h3>Emergency Contact</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Name</span><span class="field-value">{{ user.emergencyContact.name }}</span></div>
          <div class="field-row" v-if="user.emergencyContact.phone"><span class="field-label">Phone</span><span class="field-value">{{ user.emergencyContact.phone }}</span></div>
          <div class="field-row" v-if="user.emergencyContact.email"><span class="field-label">Email</span><span class="field-value">{{ user.emergencyContact.email }}</span></div>
        </div>
      </div>

      <!-- NHIS — only if registered -->
      <div class="card" v-if="user?.nhisStatus?.isActive || user?.nhisStatus?.nhisId">
        <div class="card-header"><h3>NHIS Insurance</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Status</span>
            <span class="field-value">
              <span :class="user.nhisStatus.isActive ? 'badge badge-green' : 'badge badge-gray'">
                {{ user.nhisStatus.isActive ? 'Active' : 'Inactive' }}
              </span>
            </span>
          </div>
          <div class="field-row" v-if="user.nhisStatus.nhisId"><span class="field-label">NHIS ID</span><span class="field-value">{{ user.nhisStatus.nhisId }}</span></div>
          <div class="field-row" v-if="user.nhisStatus.nhisExpiry"><span class="field-label">Expires</span><span class="field-value">{{ formatDate(user.nhisStatus.nhisExpiry) }}</span></div>
        </div>
      </div>

      <!-- Recent visits — only if present -->
      <div class="card span-2" v-if="recentEncounters.length">
        <div class="card-header"><h3>Recent Visits</h3></div>
        <div class="card-body">
          <div v-for="enc in recentEncounters" :key="enc._id" class="visit-row">
            <div class="visit-type">{{ enc.visitType }}</div>
            <div class="visit-info">
              <span class="visit-reason">{{ enc.reason }}</span>
              <span class="visit-date">{{ formatDate(enc.visitDate) }}<template v-if="enc.receiver"> · {{ enc.receiver.firstname }} {{ enc.receiver.lastname }}</template></span>
            </div>
            <div v-if="enc.diagnosis" class="visit-dx">{{ enc.diagnosis }}</div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="card">
        <div class="card-header"><h3>Quick Actions</h3></div>
        <div class="card-body actions-grid">
          <button class="action-btn" @click="router.push({ name: 'search' })">
            <span class="material-symbols-outlined">search</span> Find a Doctor
          </button>
          <button class="action-btn" @click="router.push({ name: 'appointments' })">
            <span class="material-symbols-outlined">calendar_month</span> My Appointments
          </button>
          <button class="action-btn" @click="router.push(`/mymessages/${user?._id}`)">
            <span class="material-symbols-outlined">forum</span> Messages
          </button>
        </div>
      </div>
    </div>

    <HealthCardModal v-model="showHealthCard" />
  </div>
</template>

<style scoped>
.dashboard { padding: 1.5rem; }

.profile-banner { display: flex; align-items: center; gap: 1rem; padding: 1.2rem 1.5rem; background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--green-100); margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); flex-wrap: wrap; }
.avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--green); color: var(--white); font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner-text { flex: 1; min-width: 150px; }
.banner-name { font-size: 1.2rem; color: var(--gray-900); margin-bottom: 4px; }
.banner-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.meta-dot { font-size: 0.82rem; color: var(--gray-500); }

.health-card-btn { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, var(--green) 0%, var(--green-700) 100%); color: var(--white); border: none; border-radius: var(--radius-md); padding: 0.8rem 1.1rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; font-family: var(--font); box-shadow: 0 4px 14px rgba(48,135,108,0.3); }
.health-card-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(48,135,108,0.4); }
.health-card-btn > .material-symbols-outlined:first-child { font-size: 28px; }
.hcb-text { display: flex; flex-direction: column; text-align: left; line-height: 1.3; }
.hcb-text strong { font-size: 0.92rem; }
.hcb-text small { font-size: 0.72rem; opacity: 0.85; }
.hcb-arrow { font-size: 20px; }

.dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1rem; }
.span-2 { grid-column: 1 / -1; }

/* Vitals */
.vitals-body { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.7rem; }
.vital-tile { background: var(--green-50); border-radius: var(--radius-md); padding: 0.9rem 0.6rem; text-align: center; }
.vital-icon { font-size: 26px; color: var(--green); }
.vital-num { display: block; font-size: 1.05rem; font-weight: 700; color: var(--green-800); margin-top: 4px; }
.vital-name { font-size: 0.68rem; color: var(--gray-500); }

/* Snapshot ring */
.snapshot-body { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
.ring { width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(var(--green) calc(var(--pct) * 1%), var(--gray-200) 0); display: flex; align-items: center; justify-content: center; }
.ring-center { width: 82px; height: 82px; border-radius: 50%; background: var(--white); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-num { font-size: 1.3rem; font-weight: 700; color: var(--green-800); }
.ring-label { font-size: 0.68rem; color: var(--gray-500); }
.snapshot-hint { font-size: 0.82rem; color: var(--gray-500); text-align: center; }

/* Alert card */
.alert-card { border-color: #f3c9c9; }
.critical-h { color: var(--error); }

.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--green-100); color: var(--green-800); padding: 4px 12px; border-radius: 14px; font-size: 0.85rem; font-weight: 500; }
.chip-red { background: var(--error-bg); color: var(--error); font-weight: 600; }

/* Visits */
.visit-row { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid var(--gray-100); }
.visit-row:last-child { border-bottom: none; }
.visit-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: var(--green-100); color: var(--green-800); padding: 3px 10px; border-radius: 12px; }
.visit-info { display: flex; flex-direction: column; min-width: 0; }
.visit-reason { font-size: 0.9rem; color: var(--gray-800); font-weight: 500; }
.visit-date { font-size: 0.76rem; color: var(--gray-500); }
.visit-dx { font-size: 0.8rem; color: var(--green-700); background: var(--green-50); padding: 2px 10px; border-radius: 10px; }

/* Actions */
.actions-grid { display: flex; flex-direction: column; gap: 0.6rem; }
.action-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.75rem 1rem; border: 1.5px solid var(--green-200); border-radius: var(--radius-md); background: var(--green-50); color: var(--green-800); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.18s; font-family: var(--font); }
.action-btn:hover { background: var(--green); color: var(--white); border-color: var(--green); }
.action-btn .material-symbols-outlined { font-size: 20px; }

@media (max-width: 600px) {
  .health-card-btn { width: 100%; }
}
</style>