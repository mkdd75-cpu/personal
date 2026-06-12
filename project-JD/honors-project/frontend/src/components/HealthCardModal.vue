<script setup>
import { ref, watch, computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const userStore = useUserStore()
const record = ref(null)
const loading = ref(false)
const error = ref('')

const user = computed(() => userStore.user || {})

watch(() => props.modelValue, (open) => {
  if (open) loadRecord()
})

function close() { emit('update:modelValue', false) }

async function loadRecord() {
  loading.value = true
  error.value = ''
  try {
    const res = await userStore.apiFetch(apiUrl('/my-record'))
    if (res.ok) record.value = await res.json()
    else record.value = null
  } catch (err) {
    error.value = 'Could not load your health information.'
  } finally {
    loading.value = false
  }
}

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function age(dob) {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

// ── Computed "show only if present" helpers ──────────────────────────────────
const hasValue = (v) => v !== null && v !== undefined && v !== '' &&
  !(Array.isArray(v) && v.length === 0)

const history = computed(() => record.value?.medicalHistory || {})

// Latest reading of each vital type (most recent first)
const latestVitals = computed(() => {
  const vitals = record.value?.vitals || []
  const byType = {}
  for (const v of vitals) {
    if (!byType[v.type] || new Date(v.timestamp) > new Date(byType[v.type].timestamp)) {
      byType[v.type] = v
    }
  }
  return byType
})

const vitalLabels = {
  bloodPressure: 'Blood Pressure',
  bloodGlucose: 'Blood Glucose',
  weight: 'Weight',
  height: 'Height',
  BMI: 'BMI',
}

const addressLine = computed(() => {
  const a = user.value.address || {}
  return [a.street, a.city, a.stateOrRegion].filter(Boolean).join(', ')
})

// Does the record actually have any clinical info worth showing?
const hasClinicalInfo = computed(() => {
  if (!record.value) return false
  return (
    Object.keys(latestVitals.value).length > 0 ||
    hasValue(history.value.chronicConditions) ||
    hasValue(history.value.allergies) ||
    hasValue(history.value.surgeries) ||
    hasValue(history.value.familyHistory)
  )
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="backdrop" @click.self="close">
        <div class="card-modal">
          <!-- Header -->
          <div class="hc-header">
            <div class="hc-title">
              <span class="material-symbols-outlined">badge</span>
              <div>
                <h3>Health Card</h3>
                <span class="hc-sub">Key info for visits &amp; emergencies</span>
              </div>
            </div>
            <button class="close-btn" @click="close"><span class="material-symbols-outlined">close</span></button>
          </div>

          <div class="hc-body">
            <div v-if="loading" class="status">Loading your health card…</div>
            <div v-else-if="error" class="alert alert-error">{{ error }}</div>

            <template v-else>
              <!-- Identity block — always available from profile -->
              <div class="id-block">
                <div class="id-avatar">{{ (user.firstname?.[0] || '') + (user.lastname?.[0] || '') }}</div>
                <div class="id-info">
                  <span class="id-name">{{ user.firstname }} {{ user.middlename }} {{ user.lastname }}</span>
                  <div class="id-meta">
                    <span v-if="age(user.dob)">{{ age(user.dob) }} yrs</span>
                    <span v-if="user.gender">· {{ user.gender }}</span>
                    <span v-if="user.dob">· DOB {{ fmtDate(user.dob) }}</span>
                  </div>
                </div>
              </div>

              <!-- Critical: allergies first, most important in emergencies -->
              <section v-if="hasValue(history.allergies)" class="hc-section critical">
                <h4><span class="material-symbols-outlined">warning</span> Allergies</h4>
                <div class="chip-row">
                  <span v-for="a in history.allergies" :key="a" class="chip chip-red">{{ a }}</span>
                </div>
              </section>

              <!-- Chronic conditions -->
              <section v-if="hasValue(history.chronicConditions)" class="hc-section">
                <h4><span class="material-symbols-outlined">medical_information</span> Conditions</h4>
                <div class="chip-row">
                  <span v-for="c in history.chronicConditions" :key="c" class="chip">{{ c }}</span>
                </div>
              </section>

              <!-- Latest vitals -->
              <section v-if="Object.keys(latestVitals).length" class="hc-section">
                <h4><span class="material-symbols-outlined">monitor_heart</span> Latest Vitals</h4>
                <div class="vital-grid">
                  <div v-for="(v, type) in latestVitals" :key="type" class="vital-cell">
                    <span class="vital-label">{{ vitalLabels[type] || type }}</span>
                    <span class="vital-value">{{ v.value }}</span>
                    <span class="vital-date">{{ fmtDate(v.timestamp) }}</span>
                  </div>
                </div>
              </section>

              <!-- Surgeries -->
              <section v-if="hasValue(history.surgeries)" class="hc-section">
                <h4><span class="material-symbols-outlined">surgical</span> Past Surgeries</h4>
                <ul class="plain-list">
                  <li v-for="s in history.surgeries" :key="s">{{ s }}</li>
                </ul>
              </section>

              <!-- Family history -->
              <section v-if="hasValue(history.familyHistory)" class="hc-section">
                <h4><span class="material-symbols-outlined">family_history</span> Family History</h4>
                <ul class="plain-list">
                  <li v-for="f in history.familyHistory" :key="f">{{ f }}</li>
                </ul>
              </section>

              <!-- NHIS — needed at pharmacy / hospital intake -->
              <section v-if="user.nhisStatus?.isActive || user.nhisStatus?.nhisId" class="hc-section">
                <h4><span class="material-symbols-outlined">badge</span> Insurance (NHIS)</h4>
                <div class="kv-row" v-if="user.nhisStatus?.nhisId">
                  <span class="kv-label">NHIS ID</span><span class="kv-value">{{ user.nhisStatus.nhisId }}</span>
                </div>
                <div class="kv-row" v-if="user.nhisStatus?.nhisExpiry">
                  <span class="kv-label">Valid until</span><span class="kv-value">{{ fmtDate(user.nhisStatus.nhisExpiry) }}</span>
                </div>
                <div class="kv-row" v-if="user.nhisStatus?.isActive !== undefined">
                  <span class="kv-label">Status</span>
                  <span class="kv-value">
                    <span :class="user.nhisStatus.isActive ? 'badge badge-green' : 'badge badge-gray'">
                      {{ user.nhisStatus.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </span>
                </div>
              </section>

              <!-- Emergency contact -->
              <section v-if="user.emergencyContact?.name" class="hc-section emergency">
                <h4><span class="material-symbols-outlined">emergency</span> Emergency Contact</h4>
                <div class="kv-row"><span class="kv-label">Name</span><span class="kv-value">{{ user.emergencyContact.name }}</span></div>
                <div class="kv-row" v-if="user.emergencyContact.phone">
                  <span class="kv-label">Phone</span>
                  <a class="kv-value link" :href="`tel:${user.emergencyContact.phone}`">{{ user.emergencyContact.phone }}</a>
                </div>
                <div class="kv-row" v-if="user.emergencyContact.email">
                  <span class="kv-label">Email</span><span class="kv-value">{{ user.emergencyContact.email }}</span>
                </div>
              </section>

              <!-- Contact / address for forms -->
              <section v-if="user.phone || addressLine" class="hc-section">
                <h4><span class="material-symbols-outlined">contact_page</span> My Contact</h4>
                <div class="kv-row" v-if="user.phone">
                  <span class="kv-label">Phone</span>
                  <a class="kv-value link" :href="`tel:${user.phone}`">{{ user.phone }}</a>
                </div>
                <div class="kv-row" v-if="addressLine">
                  <span class="kv-label">Address</span><span class="kv-value">{{ addressLine }}</span>
                </div>
              </section>

              <!-- Empty-state hint if no clinical info has been recorded yet -->
              <div v-if="!hasClinicalInfo" class="hc-hint">
                <span class="material-symbols-outlined">info</span>
                Your clinical details (vitals, conditions, allergies) will appear here
                once a clinician records them during a visit.
              </div>
            </template>
          </div>

          <div class="hc-footer">
            <span class="material-symbols-outlined">lock</span>
            Visible only to you. Show this at intake or in an emergency.
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.card-modal { background: var(--white); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }

.hc-header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.4rem; background: var(--green); color: var(--white); flex-shrink: 0; }
.hc-title { display: flex; align-items: center; gap: 12px; }
.hc-title > .material-symbols-outlined { font-size: 30px; }
.hc-title h3 { color: var(--white); font-size: 1.15rem; }
.hc-sub { font-size: 0.78rem; opacity: 0.9; }
.close-btn { background: rgba(255,255,255,0.15); border: none; cursor: pointer; color: var(--white); padding: 5px; border-radius: 8px; display: flex; transition: background 0.15s; }
.close-btn:hover { background: rgba(255,255,255,0.3); }

.hc-body { padding: 1.3rem 1.4rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.1rem; }
.status { text-align: center; color: var(--gray-500); padding: 2rem; }

.id-block { display: flex; align-items: center; gap: 14px; padding-bottom: 1.1rem; border-bottom: 2px solid var(--gray-100); }
.id-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--green); color: var(--white); font-weight: 700; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; text-transform: uppercase; flex-shrink: 0; }
.id-name { font-size: 1.1rem; font-weight: 700; color: var(--gray-900); display: block; }
.id-meta { font-size: 0.82rem; color: var(--gray-500); display: flex; gap: 5px; flex-wrap: wrap; margin-top: 2px; }

.hc-section h4 { display: flex; align-items: center; gap: 7px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500); margin-bottom: 0.6rem; }
.hc-section h4 .material-symbols-outlined { font-size: 17px; }

.hc-section.critical h4 { color: var(--error); }
.hc-section.emergency h4 { color: #c0392b; }

.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--green-100); color: var(--green-800); padding: 4px 12px; border-radius: 14px; font-size: 0.85rem; font-weight: 500; }
.chip-red { background: var(--error-bg); color: var(--error); font-weight: 600; }

.vital-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.6rem; }
.vital-cell { background: var(--green-50); border-radius: var(--radius-md); padding: 0.7rem 0.8rem; }
.vital-label { font-size: 0.72rem; color: var(--gray-500); display: block; }
.vital-value { font-size: 1.15rem; font-weight: 700; color: var(--green-800); display: block; line-height: 1.3; }
.vital-date { font-size: 0.68rem; color: var(--gray-400); }

.plain-list { list-style: none; display: flex; flex-direction: column; gap: 3px; }
.plain-list li { font-size: 0.9rem; color: var(--gray-700); padding-left: 14px; position: relative; }
.plain-list li::before { content: '•'; position: absolute; left: 0; color: var(--green); }

.kv-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 0.35rem 0; font-size: 0.9rem; }
.kv-label { color: var(--gray-500); font-weight: 600; font-size: 0.82rem; }
.kv-value { color: var(--gray-800); }
.kv-value.link { color: var(--green); font-weight: 600; }

.hc-hint { display: flex; align-items: flex-start; gap: 8px; background: var(--info-bg); color: var(--info); padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; line-height: 1.5; }
.hc-hint .material-symbols-outlined { font-size: 18px; flex-shrink: 0; }

.hc-footer { display: flex; align-items: center; gap: 7px; padding: 0.8rem 1.4rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); font-size: 0.78rem; color: var(--gray-500); flex-shrink: 0; }
.hc-footer .material-symbols-outlined { font-size: 15px; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-active .card-modal, .modal-leave-active .card-modal { transition: transform 0.22s, opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .card-modal { transform: translateY(-16px) scale(0.97); opacity: 0; }
</style>