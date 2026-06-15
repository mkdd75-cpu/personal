<script setup>
import { ref, watch, computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  patient: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const userStore = useUserStore()
const record = ref(null)
const encounters = ref([])
const loading = ref(false)
const error = ref('')
const activeTab = ref('overview')

// Form state for adding new data
const newVital = ref({ type: 'bloodPressure', value: '' })
const newLab = ref({ testName: '', value: '', normalRange: '' })
const newEncounter = ref({
  visitType: 'screening', visitDate: '', reason: '', diagnosis: '',
  treatment: '', counselingNotes: '',
})
const historyEdit = ref({ chronicConditions: '', allergies: '', surgeries: '', familyHistory: '' })
const savingSection = ref('')

const vitalTypes = ['bloodPressure', 'bloodGlucose', 'weight', 'height', 'BMI']
const visitTypes = ['screening', 'acute', 'follow-up', 'counseling']

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'summarize' },
  { id: 'vitals', label: 'Vitals', icon: 'monitor_heart' },
  { id: 'labs', label: 'Labs', icon: 'science' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'encounters', label: 'Encounters', icon: 'event_note' },
]

watch(() => props.modelValue, (open) => {
  if (open && props.patient) loadRecord()
})

function close() { emit('update:modelValue', false) }

async function loadRecord() {
  loading.value = true
  error.value = ''
  activeTab.value = 'overview'
  try {
    const res = await userStore.apiFetch(apiUrl(`/records/${props.patient._id}`))
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Failed to load record')
    }
    record.value = await res.json()
    encounters.value = record.value.encounters || []

    // History inputs start blank — they are "add new item" fields. Existing
    // saved history is shown above the inputs (read-only) in the History tab.
    historyEdit.value = { chronicConditions: '', allergies: '', surgeries: '', familyHistory: '' }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function addVital() {
  if (!newVital.value.value.trim()) return
  savingSection.value = 'vital'
  try {
    const res = await userStore.apiFetch(apiUrl(`/records/${props.patient._id}/vitals`), {
      method: 'PATCH', body: JSON.stringify(newVital.value),
    })
    if (res.ok) { record.value = await res.json(); newVital.value.value = '' }
  } catch (err) { console.error(err) }
  finally { savingSection.value = '' }
}

async function addLab() {
  if (!newLab.value.testName.trim() || !newLab.value.value.trim()) return
  savingSection.value = 'lab'
  try {
    const res = await userStore.apiFetch(apiUrl(`/records/${props.patient._id}/labs`), {
      method: 'PATCH', body: JSON.stringify(newLab.value),
    })
    if (res.ok) { record.value = await res.json(); newLab.value = { testName: '', value: '', normalRange: '' } }
  } catch (err) { console.error(err) }
  finally { savingSection.value = '' }
}

async function saveHistory() {
  savingSection.value = 'history'
  const toArr = (s) => s.split(',').map(x => x.trim()).filter(Boolean)
  try {
    const res = await userStore.apiFetch(apiUrl(`/records/${props.patient._id}/history`), {
      method: 'PATCH',
      body: JSON.stringify({
        chronicConditions: toArr(historyEdit.value.chronicConditions),
        allergies: toArr(historyEdit.value.allergies),
        surgeries: toArr(historyEdit.value.surgeries),
        familyHistory: toArr(historyEdit.value.familyHistory),
      }),
    })
    if (res.ok) {
      record.value = await res.json()
      // Leave the input boxes blank after a successful save — the saved values
      // are now shown in the Overview tab; the inputs become "add more" fields.
      historyEdit.value = { chronicConditions: '', allergies: '', surgeries: '', familyHistory: '' }
    }
  } catch (err) { console.error(err) }
  finally { savingSection.value = '' }
}

async function addEncounter() {
  const e = newEncounter.value
  if (!e.visitDate || !e.reason.trim()) { error.value = 'Encounter needs a date and reason.'; return }
  savingSection.value = 'encounter'
  error.value = ''
  try {
    const payload = {
      visitType: e.visitType,
      visitDate: e.visitDate,
      reason: e.reason.trim(),
      diagnosis: e.diagnosis.trim(),
      counselingNotes: e.counselingNotes.trim(),
      treatment: e.treatment.trim()
        ? [{ medication: e.treatment.trim(), dose: '', duration: '' }]
        : [],
    }
    const res = await userStore.apiFetch(apiUrl(`/records/${props.patient._id}/encounters`), {
      method: 'POST', body: JSON.stringify(payload),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
    await loadRecord()
    newEncounter.value = { visitType: 'screening', visitDate: '', reason: '', diagnosis: '', treatment: '', counselingNotes: '' }
    activeTab.value = 'encounters'
  } catch (err) { error.value = err.message }
  finally { savingSection.value = '' }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const history = computed(() => record.value?.medicalHistory || {})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="backdrop" @click.self="close">
        <div class="modal">
          <!-- Header -->
          <div class="modal-header">
            <div class="patient-id" v-if="patient">
              <div class="avatar">{{ (patient.firstname?.[0] || '') + (patient.lastname?.[0] || '') }}</div>
              <div>
                <h3>{{ patient.firstname }} {{ patient.lastname }}</h3>
                <span class="sub">Medical Record</span>
              </div>
            </div>
            <button class="close-btn" @click="close"><span class="material-symbols-outlined">close</span></button>
          </div>

          <!-- Tabs -->
          <div class="tab-bar">
            <button
              v-for="t in tabs" :key="t.id"
              class="tab" :class="{ active: activeTab === t.id }"
              @click="activeTab = t.id"
            >
              <span class="material-symbols-outlined">{{ t.icon }}</span>
              <span class="tab-label">{{ t.label }}</span>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <div v-if="loading" class="status">Loading record…</div>
            <div v-else-if="error" class="alert alert-error">{{ error }}</div>

            <template v-else-if="record">
              <!-- OVERVIEW -->
              <div v-show="activeTab === 'overview'" class="tab-pane">
                <div class="stat-grid">
                  <div class="stat"><span class="stat-num">{{ record.vitals?.length || 0 }}</span><span class="stat-label">Vitals logged</span></div>
                  <div class="stat"><span class="stat-num">{{ record.labResults?.length || 0 }}</span><span class="stat-label">Lab results</span></div>
                  <div class="stat"><span class="stat-num">{{ encounters.length }}</span><span class="stat-label">Encounters</span></div>
                </div>
                <h4 class="pane-heading">Conditions</h4>
                <div class="chip-row" v-if="history.chronicConditions?.length">
                  <span v-for="c in history.chronicConditions" :key="c" class="chip">{{ c }}</span>
                </div>
                <p v-else class="muted">None recorded</p>

                <h4 class="pane-heading">Allergies</h4>
                <div class="chip-row" v-if="history.allergies?.length">
                  <span v-for="a in history.allergies" :key="a" class="chip chip-red">{{ a }}</span>
                </div>
                <p v-else class="muted">None recorded</p>
              </div>

              <!-- VITALS -->
              <div v-show="activeTab === 'vitals'" class="tab-pane">
                <div class="add-row">
                  <select v-model="newVital.type">
                    <option v-for="t in vitalTypes" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <input v-model="newVital.value" placeholder="Value (e.g. 120/80)" @keyup.enter="addVital" />
                  <button class="btn btn-primary btn-sm" @click="addVital" :disabled="savingSection==='vital'">Add</button>
                </div>
                <div v-if="!record.vitals?.length" class="muted mt-2">No vitals recorded yet.</div>
                <div v-for="(v, i) in [...(record.vitals||[])].reverse()" :key="i" class="data-row">
                  <span class="data-type">{{ v.type }}</span>
                  <span class="data-value">{{ v.value }}</span>
                  <span class="data-date">{{ fmtDate(v.timestamp) }}</span>
                </div>
              </div>

              <!-- LABS -->
              <div v-show="activeTab === 'labs'" class="tab-pane">
                <div class="add-col">
                  <input v-model="newLab.testName" placeholder="Test name" />
                  <div class="add-row">
                    <input v-model="newLab.value" placeholder="Result value" />
                    <input v-model="newLab.normalRange" placeholder="Normal range" />
                    <button class="btn btn-primary btn-sm" @click="addLab" :disabled="savingSection==='lab'">Add</button>
                  </div>
                </div>
                <div v-if="!record.labResults?.length" class="muted mt-2">No lab results recorded yet.</div>
                <div v-for="(l, i) in [...(record.labResults||[])].reverse()" :key="i" class="data-row">
                  <span class="data-type">{{ l.testName }}</span>
                  <span class="data-value">{{ l.value }}<small v-if="l.normalRange"> (range {{ l.normalRange }})</small></span>
                  <span class="data-date">{{ fmtDate(l.timestamp) }}</span>
                </div>
              </div>

              <!-- HISTORY -->
              <div v-show="activeTab === 'history'" class="tab-pane">
                <!-- Existing recorded history (read-only) -->
                <div v-if="history.chronicConditions?.length || history.allergies?.length || history.surgeries?.length || history.familyHistory?.length" class="existing-history">
                  <div v-if="history.chronicConditions?.length" class="eh-group">
                    <span class="eh-label">Conditions</span>
                    <div class="chip-row">
                      <span v-for="c in history.chronicConditions" :key="c" class="chip">{{ c }}</span>
                    </div>
                  </div>
                  <div v-if="history.allergies?.length" class="eh-group">
                    <span class="eh-label">Allergies</span>
                    <div class="chip-row">
                      <span v-for="a in history.allergies" :key="a" class="chip chip-red">{{ a }}</span>
                    </div>
                  </div>
                  <div v-if="history.surgeries?.length" class="eh-group">
                    <span class="eh-label">Surgeries</span>
                    <div class="chip-row">
                      <span v-for="s in history.surgeries" :key="s" class="chip">{{ s }}</span>
                    </div>
                  </div>
                  <div v-if="history.familyHistory?.length" class="eh-group">
                    <span class="eh-label">Family history</span>
                    <div class="chip-row">
                      <span v-for="f in history.familyHistory" :key="f" class="chip">{{ f }}</span>
                    </div>
                  </div>
                </div>

                <p class="hint">Add new items below (comma-separated). Existing entries above are kept.</p>
                <label class="field">Chronic conditions
                  <input v-model="historyEdit.chronicConditions" placeholder="e.g. Hypertension, Diabetes" />
                </label>
                <label class="field">Allergies
                  <input v-model="historyEdit.allergies" placeholder="e.g. Penicillin" />
                </label>
                <label class="field">Surgeries
                  <input v-model="historyEdit.surgeries" placeholder="e.g. Appendectomy 2019" />
                </label>
                <label class="field">Family history
                  <input v-model="historyEdit.familyHistory" placeholder="e.g. Heart disease" />
                </label>
                <button class="btn btn-primary btn-full mt-1" @click="saveHistory" :disabled="savingSection==='history'">
                  {{ savingSection==='history' ? 'Saving…' : 'Save History' }}
                </button>
              </div>

              <!-- ENCOUNTERS -->
              <div v-show="activeTab === 'encounters'" class="tab-pane">
                <details class="enc-form-wrap">
                  <summary>+ Record new encounter</summary>
                  <div class="enc-form">
                    <div class="add-row">
                      <select v-model="newEncounter.visitType">
                        <option v-for="t in visitTypes" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <input v-model="newEncounter.visitDate" type="date" />
                    </div>
                    <input v-model="newEncounter.reason" placeholder="Reason for visit *" />
                    <input v-model="newEncounter.diagnosis" placeholder="Diagnosis" />
                    <input v-model="newEncounter.treatment" placeholder="Treatment / medication" />
                    <textarea v-model="newEncounter.counselingNotes" rows="2" placeholder="Notes"></textarea>
                    <button class="btn btn-primary btn-full" @click="addEncounter" :disabled="savingSection==='encounter'">
                      {{ savingSection==='encounter' ? 'Saving…' : 'Save Encounter' }}
                    </button>
                  </div>
                </details>

                <div v-if="!encounters.length" class="muted mt-2">No encounters recorded yet.</div>
                <div v-for="enc in encounters" :key="enc._id" class="enc-card">
                  <div class="enc-head">
                    <span class="enc-type">{{ enc.visitType }}</span>
                    <span class="enc-date">{{ fmtDateTime(enc.visitDate) }}</span>
                  </div>
                  <p class="enc-reason"><strong>Reason:</strong> {{ enc.reason }}</p>
                  <p v-if="enc.diagnosis" class="enc-line"><strong>Diagnosis:</strong> {{ enc.diagnosis }}</p>
                  <p v-if="enc.treatment?.length" class="enc-line"><strong>Treatment:</strong> {{ enc.treatment.map(t => t.medication).filter(Boolean).join(', ') }}</p>
                  <p v-if="enc.counselingNotes" class="enc-line"><strong>Notes:</strong> {{ enc.counselingNotes }}</p>
                  <p v-if="enc.receiver" class="enc-by">Recorded by {{ enc.receiver.firstname }} {{ enc.receiver.lastname }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: var(--white); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 560px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; border-top: 4px solid var(--green); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.4rem; border-bottom: 1px solid var(--gray-200); flex-shrink: 0; }
.patient-id { display: flex; align-items: center; gap: 12px; }
.avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--green); color: var(--white); font-weight: 700; display: flex; align-items: center; justify-content: center; text-transform: uppercase; flex-shrink: 0; }
.patient-id h3 { color: var(--gray-900); font-size: 1.05rem; }
.sub { font-size: 0.8rem; color: var(--green); }
.close-btn { background: none; border: none; cursor: pointer; color: var(--gray-500); padding: 4px; border-radius: 6px; display: flex; }
.close-btn:hover { background: var(--gray-100); }

.tab-bar { display: flex; border-bottom: 1px solid var(--gray-200); background: var(--gray-50); flex-shrink: 0; overflow-x: auto; }
.tab { flex: 1; min-width: 72px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0.6rem 0.4rem; border: none; background: none; cursor: pointer; color: var(--gray-500); font-size: 0.72rem; font-weight: 600; border-bottom: 2.5px solid transparent; transition: all 0.15s; font-family: var(--font); }
.tab:hover { color: var(--green); }
.tab.active { color: var(--green); border-bottom-color: var(--green); background: var(--white); }
.tab .material-symbols-outlined { font-size: 20px; }

.modal-body { padding: 1.3rem 1.4rem; overflow-y: auto; flex: 1; }
.status { text-align: center; color: var(--gray-500); padding: 2rem; }
.muted { color: var(--gray-400); font-size: 0.88rem; }
.mt-2 { margin-top: 0.8rem; }
.mt-1 { margin-top: 0.4rem; }

.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin-bottom: 1.2rem; }
.stat { background: var(--green-50); border-radius: var(--radius-md); padding: 0.9rem; text-align: center; }
.stat-num { display: block; font-size: 1.6rem; font-weight: 700; color: var(--green); }
.stat-label { font-size: 0.72rem; color: var(--gray-500); }

.pane-heading { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500); margin: 1rem 0 0.5rem; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--green-100); color: var(--green-800); padding: 3px 11px; border-radius: 14px; font-size: 0.82rem; font-weight: 500; }
.chip-red { background: var(--error-bg); color: var(--error); }

.add-row { display: flex; gap: 8px; align-items: center; margin-bottom: 0.5rem; }
.add-row select, .add-row input { flex: 1; }
.add-col { display: flex; flex-direction: column; gap: 8px; margin-bottom: 0.5rem; }

.data-row { display: grid; grid-template-columns: 1fr 1.3fr auto; gap: 10px; align-items: center; padding: 0.55rem 0; border-bottom: 1px solid var(--gray-100); font-size: 0.88rem; }
.data-type { font-weight: 600; color: var(--green-800); text-transform: capitalize; }
.data-value { color: var(--gray-800); }
.data-value small { color: var(--gray-400); }
.data-date { font-size: 0.75rem; color: var(--gray-400); }

.field { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; font-weight: 600; color: var(--gray-700); margin-bottom: 0.7rem; }
.hint { font-size: 0.8rem; color: var(--gray-500); margin-bottom: 0.8rem; }
.existing-history { background: var(--gray-50); border-radius: var(--radius-md); padding: 0.9rem 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.7rem; }
.eh-group { display: flex; flex-direction: column; gap: 5px; }
.eh-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500); font-weight: 700; }

.enc-form-wrap { margin-bottom: 1rem; border: 1px solid var(--green-200); border-radius: var(--radius-md); overflow: hidden; }
.enc-form-wrap summary { padding: 0.7rem 1rem; background: var(--green-50); color: var(--green-800); font-weight: 600; font-size: 0.88rem; cursor: pointer; }
.enc-form { padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
textarea { resize: vertical; font-family: var(--font); }

.enc-card { border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 0.9rem; margin-bottom: 0.7rem; }
.enc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.enc-type { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: var(--green-100); color: var(--green-800); padding: 2px 10px; border-radius: 12px; }
.enc-date { font-size: 0.78rem; color: var(--gray-500); }
.enc-reason, .enc-line { font-size: 0.86rem; color: var(--gray-700); margin-bottom: 3px; }
.enc-by { font-size: 0.76rem; color: var(--gray-400); margin-top: 0.4rem; font-style: italic; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.22s, opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { transform: translateY(-16px) scale(0.97); opacity: 0; }
</style>