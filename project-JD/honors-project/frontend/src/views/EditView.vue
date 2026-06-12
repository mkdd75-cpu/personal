<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const patient = ref(null)
const loading = ref(true)
const saving = ref(false)
const editMode = ref(false)
const successMsg = ref('')
const errorMsg = ref('')

onMounted(async () => {
  try {
    const res = await userStore.apiFetch(apiUrl(`/users/${route.params.user_id}`))
    if (!res.ok) throw new Error('Patient not found')
    patient.value = await res.json()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
})

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function saveChanges() {
  saving.value = true
  successMsg.value = ''
  errorMsg.value = ''
  try {
    const res = await userStore.apiFetch(apiUrl(`/users/${patient.value._id}`), {
      method: 'PATCH',
      body: JSON.stringify({
        phone: patient.value.phone,
        address: patient.value.address,
        emergencyContact: patient.value.emergencyContact,
        nhisStatus: patient.value.nhisStatus,
        riskCategory: patient.value.riskCategory,
      }),
    })
    if (!res.ok) throw new Error('Failed to save changes')
    patient.value = await res.json()
    editMode.value = false
    successMsg.value = 'Patient record updated successfully.'
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="edit-view">
    <div class="edit-header">
      <button class="btn btn-ghost btn-sm" @click="router.back()">
        <span class="material-symbols-outlined">arrow_back</span> Back
      </button>
      <h2>Patient Details</h2>
    </div>

    <div v-if="loading" class="status-msg">Loading patient data…</div>
    <div v-else-if="errorMsg && !patient" class="alert alert-error">{{ errorMsg }}</div>

    <div v-else-if="patient" class="edit-body">
      <div class="card mb-2">
        <div class="card-header">
          <div class="patient-identity">
            <div class="avatar">{{ patient.firstname?.charAt(0) }}{{ patient.lastname?.charAt(0) }}</div>
            <div>
              <h3>{{ patient.firstname }} {{ patient.lastname }}</h3>
              <span class="badge badge-gray">{{ patient.role }}</span>
            </div>
          </div>
          <div class="header-btns">
            <button v-if="editMode" class="btn btn-primary btn-sm" @click="saveChanges" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button class="btn btn-outline btn-sm" @click="editMode = !editMode">
              {{ editMode ? 'Cancel' : 'Edit Record' }}
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Email</span><span class="field-value">{{ patient.email }}</span></div>
          <div class="field-row"><span class="field-label">Gender</span><span class="field-value">{{ patient.gender || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Date of Birth</span><span class="field-value">{{ formatDate(patient.dob) }}</span></div>
          <div class="field-row">
            <span class="field-label">Phone</span>
            <span class="field-value">
              <input v-if="editMode" v-model="patient.phone" type="tel" style="max-width:220px" />
              <template v-else>{{ patient.phone || '—' }}</template>
            </span>
          </div>
          <div class="field-row">
            <span class="field-label">Risk Category</span>
            <span class="field-value">
              <select v-if="editMode" v-model="patient.riskCategory" style="max-width:180px">
                <option value="">Not set</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
              <span v-else :class="['badge', patient.riskCategory === 'high' ? 'badge-red' : 'badge-green']">
                {{ patient.riskCategory || 'Not set' }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="(patient.medicalRecords || []).length" class="card mb-2">
        <div class="card-header"><h3>Medical Records</h3></div>
        <div class="card-body">
          <div v-for="record in patient.medicalRecords" :key="record._id || record" class="record-item">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--green)">folder_shared</span>
            Record ID: {{ record._id || record }}
          </div>
        </div>
      </div>

      <div v-if="successMsg" class="alert alert-success mt-2">{{ successMsg }}</div>
      <div v-if="errorMsg" class="alert alert-error mt-2">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.edit-view { padding: 1.5rem; }
.edit-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.edit-header h2 { margin: 0; }
.status-msg { padding: 2rem; text-align: center; color: var(--gray-500); }
.edit-body { display: flex; flex-direction: column; gap: 1rem; }
.mb-2 { margin-bottom: 0; }
.mt-2 { margin-top: 0.5rem; }
.patient-identity { display: flex; align-items: center; gap: 12px; }
.avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--green); color: var(--white); font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.header-btns { display: flex; gap: 8px; }
.record-item { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--gray-700); padding: 0.4rem 0; border-bottom: 1px solid var(--gray-100); }
.record-item:last-child { border-bottom: none; }
</style>