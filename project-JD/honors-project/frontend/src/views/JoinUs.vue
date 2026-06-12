<script setup>
import FooterView from '@/components/FooterView.vue'
import HeaderView from '@/components/HeaderView.vue'
import { useUserStore } from '@/stores/counter'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const router = useRouter()
const currentTab = ref('patient')
const errorMessage = ref('')
const loading = ref(false)

// Personal Info
const firstname = ref('')
const middlename = ref('')
const lastname = ref('')
const email = ref('')
const phone = ref('')
const dob = ref('')
const gender = ref('Male')

// Address
const street = ref('')
const city = ref('')
const stateOrRegion = ref('')

// Role-based
const cohort = ref('')
const specialization = ref('')

// Patient-specific
const emergencyName = ref('')
const emergencyPhone = ref('')
const emergencyEmail = ref('')
const nhisStatus = ref(false)
const nhisExpiry = ref('')
const nationalId = ref('')

// Authentication
const password = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  loading.value = true

  const formData = {
    firstname: firstname.value,
    middlename: middlename.value,
    lastname: lastname.value,
    email: email.value,
    phone: phone.value,
    dob: dob.value,
    gender: gender.value,
    address: {
      street: street.value,
      city: city.value,
      stateOrRegion: stateOrRegion.value,
    },
    role: currentTab.value,
    cohort: cohort.value || undefined,
    specialization: specialization.value || undefined,
    emergencyContact: currentTab.value === 'patient' ? {
      name: emergencyName.value,
      phone: emergencyPhone.value,
      email: emergencyEmail.value,
    } : undefined,
    nhisStatus: nhisStatus.value,
    nhisExpiry: nhisExpiry.value || undefined,
    nationalId: nationalId.value || undefined,
    password: password.value,
  }

  try {
    const response = await fetch(apiUrl('/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create account')
    }

    // Store token + user (never the raw object in localStorage)
    userStore.setAuth(data.token, data.user)
    router.push({ name: 'main' })
  } catch (err) {
    console.error(err)
    errorMessage.value = err.message || 'Error creating account. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <HeaderView />
  <div class="joinus-container">

    <div class="role-select">
      <button :class="{ active: currentTab === 'patient' }" @click="currentTab = 'patient'">Patient</button>
      <button :class="{ active: currentTab === 'doctor' }" @click="currentTab = 'doctor'">Doctor</button>
      <button :class="{ active: currentTab === 'preceptor' }" @click="currentTab = 'preceptor'">Preceptor</button>
    </div>

    <form @submit.prevent="handleSubmit" class="joinus-form">
      <h2>{{ currentTab.charAt(0).toUpperCase() + currentTab.slice(1) }} Sign Up</h2>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div class="form-section">
        <h3>Personal Information</h3>

        <label>First Name:
          <input v-model="firstname" placeholder="First Name" required />
        </label>

        <label>Middle Name:
          <input v-model="middlename" placeholder="Middle Name" />
        </label>

        <label>Last Name:
          <input v-model="lastname" placeholder="Last Name" required />
        </label>

        <label>Email:
          <input v-model="email" type="email" placeholder="Email" required />
        </label>

        <label>Phone:
          <input v-model="phone" placeholder="Phone" required />
        </label>

        <label>Date of Birth:
          <input v-model="dob" type="date" required />
        </label>

        <label>Gender:
          <select v-model="gender" required>
            <option disabled value="">Select gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
        </label>
      </div>

      <div class="form-section">
        <h3>Address</h3>

        <label>Street:
          <input v-model="street" placeholder="Street" required />
        </label>

        <label>City:
          <input v-model="city" placeholder="City" required />
        </label>

        <label>State/Region:
          <input v-model="stateOrRegion" placeholder="State/Region" required />
        </label>
      </div>

      <div v-if="currentTab === 'patient'" class="form-section">
        <h3>Emergency Contact</h3>

        <label>Name:
          <input v-model="emergencyName" placeholder="Emergency Contact Name" required />
        </label>

        <label>Email:
          <input v-model="emergencyEmail" type="email" placeholder="Emergency Contact Email" />
        </label>

        <label>Phone:
          <input v-model="emergencyPhone" placeholder="Emergency Contact Phone" />
        </label>

        <label class="checkbox">
          <input type="checkbox" v-model="nhisStatus" />
          NHIS Registered?
        </label>

        <template v-if="nhisStatus">
          <label>National ID / Clinic ID:
            <input v-model="nationalId" placeholder="National ID / Clinic ID" />
          </label>
          <label>NHIS Expiry Date:
            <input v-model="nhisExpiry" type="date" />
          </label>
        </template>
      </div>

      <div v-if="currentTab === 'doctor' || currentTab === 'preceptor'" class="form-section">
        <h3>{{ currentTab.charAt(0).toUpperCase() + currentTab.slice(1) }} Details</h3>

        <label>Cohort:
          <input v-model="cohort" placeholder="Cohort" required />
        </label>

        <label>Specialization:
          <input v-model="specialization" placeholder="Specialization" required />
        </label>
      </div>

      <div class="form-section">
        <label>Password:
          <input v-model="password" type="password" placeholder="Password (min 8 characters)" required />
        </label>
      </div>

      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? 'Creating account…' : 'Sign Up' }}
      </button>
      <p class="signin-link">
        Already have an account?
        <RouterLink to="/signin">Sign in</RouterLink>
      </p>
    </form>
  </div>
  <FooterView />
</template>

<style scoped>
.joinus-container {
  background-color: #f7f7f7;
  color: #222;
  padding: 2rem;
  font-family: 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.signin-link {
  margin-top: 1.5rem;
  font-size: 0.95rem;
}

.signin-link a {
  color: #30876c;
  text-decoration: none;
  font-weight: 600;
}

.signin-link a:hover {
  text-decoration: underline;
}

.role-select {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.role-select button {
  padding: 0.7rem 1.5rem;
  border: 1px solid #30876c;
  border-radius: 6px;
  background-color: transparent;
  color: #30876c;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
}

.role-select button.active,
.role-select button:hover {
  background-color: #30876c;
  color: #fff;
}

.joinus-form {
  background-color: #fff;
  padding: 2rem 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(48, 135, 108, 0.2);
  border-top: 4px solid #30876c;
  width: 100%;
  max-width: 600px;
}

.joinus-form h2 {
  color: #30876c;
  text-align: center;
  margin-bottom: 1.5rem;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section h3 {
  color: #30876c;
  border-bottom: 2px solid #30876c;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
}

label {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
  font-weight: 500;
}

input,
select {
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 0.95rem;
  margin-top: 0.25rem;
}

input:focus,
select:focus {
  border-color: #30876c;
  outline: none;
  box-shadow: 0 0 5px rgba(48, 135, 108, 0.4);
}

.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.checkbox input {
  margin-top: 0;
  width: auto;
}

.submit-btn {
  width: 100%;
  background-color: #30876c;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.9rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #256a55;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #b00020;
  background: #fff0f0;
  border: 1px solid #f5c2c2;
  border-radius: 6px;
  padding: 0.7rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
</style>