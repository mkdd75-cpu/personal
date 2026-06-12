<script setup>
import { useUserStore } from '@/stores/counter'
import { ref, watch } from 'vue'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const editing = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const saving = ref(false)

// Deep copy with safe fallbacks for nested objects
const user = ref(
  JSON.parse(JSON.stringify(
    userStore.user || { address: {}, emergencyContact: {} }
  ))
)

// Keep in sync if the store is updated elsewhere (e.g. after save)
watch(
  () => userStore.user,
  (newVal) => {
    if (!editing.value) {
      user.value = JSON.parse(JSON.stringify(
        newVal || { address: {}, emergencyContact: {} }
      ))
    }
  },
  { deep: true }
)

function toggleEdit() {
  editing.value = !editing.value
  successMessage.value = ''
  errorMessage.value = ''

  // Discard changes if cancelling
  if (!editing.value) {
    user.value = JSON.parse(JSON.stringify(
      userStore.user || { address: {}, emergencyContact: {} }
    ))
  }
}

const isPatient = () => userStore.user?.role?.toLowerCase() === 'patient'
const showAddress = () => ['patient', 'preceptor'].includes(userStore.user?.role?.toLowerCase())

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

async function saveChanges() {
  if (!user.value._id) {
    errorMessage.value = 'User ID missing. Cannot update profile.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    user.value.address = user.value.address || {}
    user.value.emergencyContact = user.value.emergencyContact || {}

    const res = await userStore.apiFetch(apiUrl(`/users/${user.value._id}`), {
      method: 'PATCH',
      body: JSON.stringify(user.value),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update profile')
    }

    const savedData = await res.json()

    // Update the store and local copy
    userStore.user = savedData
    user.value = JSON.parse(JSON.stringify(savedData))
    editing.value = false
    successMessage.value = 'Profile updated successfully!'
  } catch (err) {
    console.error('Error updating user:', err)
    errorMessage.value = err.message || 'Failed to save changes. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-wrapper">
    <div class="profile-container">
      <header class="profile-header">
        <h2>User Profile</h2>
        <div class="header-actions">
          <button
            v-if="editing"
            class="action-btn save"
            @click="saveChanges"
            :disabled="saving"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <button
            class="action-btn"
            @click="toggleEdit"
            :title="editing ? 'Cancel' : 'Edit profile'"
          >
            {{ editing ? 'Cancel' : 'Edit' }}
          </button>
        </div>
      </header>

      <section class="info-section">
        <h3>Personal Information</h3>

        <div class="field">
          <label>First Name</label>
          <input v-if="editing" v-model="user.firstname" type="text" />
          <p v-else>{{ user.firstname || '—' }}</p>
        </div>

        <div class="field" v-if="editing || user.middlename">
          <label>Middle Name</label>
          <input v-if="editing" v-model="user.middlename" type="text" />
          <p v-else>{{ user.middlename || '—' }}</p>
        </div>

        <div class="field">
          <label>Last Name</label>
          <input v-if="editing" v-model="user.lastname" type="text" />
          <p v-else>{{ user.lastname || '—' }}</p>
        </div>

        <div class="field">
          <label>Email</label>
          <!-- Email is in the blocklist — show read-only always -->
          <p>{{ user.email || '—' }}</p>
        </div>

        <div class="field">
          <label>Phone</label>
          <input v-if="editing" v-model="user.phone" type="tel" />
          <p v-else>{{ user.phone || '—' }}</p>
        </div>

        <div class="field">
          <label>Date of Birth</label>
          <input v-if="editing" v-model="user.dob" type="date" />
          <p v-else>{{ formatDate(user.dob) }}</p>
        </div>

        <div class="field">
          <label>Gender</label>
          <select v-if="editing" v-model="user.gender">
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
          <p v-else>{{ user.gender || '—' }}</p>
        </div>

        <div class="field" v-if="showAddress()">
          <label>Address</label>
          <template v-if="editing">
            <input v-model="user.address.street" type="text" placeholder="Street" class="sub-input" />
            <input v-model="user.address.city" type="text" placeholder="City" class="sub-input" />
            <input v-model="user.address.stateOrRegion" type="text" placeholder="State or Region" class="sub-input" />
          </template>
          <p v-else>
            {{ [user.address?.street, user.address?.city, user.address?.stateOrRegion].filter(Boolean).join(', ') || '—' }}
          </p>
        </div>
      </section>

      <section v-if="isPatient()" class="info-section">
        <h3>Emergency Contact</h3>

        <div class="field">
          <label>Name</label>
          <input v-if="editing" v-model="user.emergencyContact.name" type="text" />
          <p v-else>{{ user.emergencyContact?.name || '—' }}</p>
        </div>

        <div class="field">
          <label>Email</label>
          <input v-if="editing" v-model="user.emergencyContact.email" type="email" />
          <p v-else>{{ user.emergencyContact?.email || '—' }}</p>
        </div>

        <div class="field">
          <label>Phone</label>
          <input v-if="editing" v-model="user.emergencyContact.phone" type="tel" />
          <p v-else>{{ user.emergencyContact?.phone || '—' }}</p>
        </div>
      </section>

      <p v-if="successMessage" class="success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.profile-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 1rem;
  background: #eef2ef;
  box-sizing: border-box;
  min-height: 100%;
}

.profile-container {
  width: 100%;
  max-width: 720px;
  background: #ffffff;
  border-radius: 18px;
  padding: 2rem;
  color: #2b6452;
  box-shadow: 0 4px 14px rgba(48, 135, 108, 0.12);
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.8rem;
  margin-bottom: 1.2rem;
  border-bottom: 2px solid #30876c;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
}

.profile-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #30876c;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background-color: #fff;
  border: 2px solid #30876c;
  color: #30876c;
  padding: 0.4rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: 0.2s;
}

.action-btn:hover:not(:disabled) {
  background-color: #30876c;
  color: #fff;
}

.action-btn.save {
  background-color: #30876c;
  color: #fff;
}

.action-btn.save:hover:not(:disabled) {
  background-color: #26725a;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-section {
  margin-bottom: 1.8rem;
}

.info-section h3 {
  margin-bottom: 0.8rem;
  color: #30876c;
  border-bottom: 1.5px solid #d4e9e2;
  padding-bottom: 0.3rem;
  font-size: 1rem;
}

.field {
  margin: 0.8rem 0;
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: start;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #555;
  padding-top: 0.4rem;
}

.field input,
.field select {
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1.5px solid #30876c;
  border-radius: 7px;
  background: #f9f9f9;
  color: #2b6452;
  font-size: 0.95rem;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: #1d6b50;
  background: #fff;
}

.sub-input {
  margin-bottom: 0.4rem;
}

.field p {
  margin: 0;
  padding: 0.4rem 0;
  font-size: 0.95rem;
  color: #333;
}

.success {
  color: #1f8b4c;
  text-align: center;
  font-weight: 600;
  margin-top: 1.2rem;
  padding: 0.6rem;
  background: #f0fff7;
  border-radius: 6px;
}

.error {
  color: #b00020;
  text-align: center;
  font-weight: 600;
  margin-top: 1.2rem;
  padding: 0.6rem;
  background: #fff0f0;
  border-radius: 6px;
}

@media (max-width: 500px) {
  .field {
    grid-template-columns: 1fr;
  }

  .profile-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>