<script setup>
import FooterView from '@/components/FooterView.vue'
import HeaderView from '@/components/HeaderView.vue'
import { useUserStore } from '@/stores/counter'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleLogin() {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Please fill in both fields.'
    return
  }

  loading.value = true

  try {
    const response = await fetch(apiUrl('/user/signin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password.')
    }

    // Store the token + user in the Pinia store
    userStore.setAuth(data.token, data.user)
    router.push('/main')
  } catch (err) {
    errorMessage.value = err.message || 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <HeaderView />

  <div class="signin-container">
    <h2>Sign In</h2>

    <form @submit.prevent="handleLogin" class="signin-form">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" placeholder="Enter your email" required />

      <label for="password">Password</label>
      <input id="password" v-model="password" type="password" placeholder="Enter your password" required />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Login' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <p class="join-link">
      Don't have an account?
      <RouterLink to="/joinus">Join Us</RouterLink>
    </p>
  </div>

  <FooterView />
</template>

<style scoped>
.signin-container {
  max-width: 420px;
  margin: 60px auto;
  padding: 2.5rem;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: 0 4px 15px rgba(48, 135, 108, 0.1);
  border-top: 4px solid #30876c;
  text-align: center;
}

h2 {
  color: #30876c;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.signin-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  text-align: left;
}

label {
  font-weight: 600;
  color: #333;
}

input {
  width: 100%;
  padding: 0.7rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  background-color: #f7f7f7;
  transition: border 0.3s;
}

input:focus {
  border-color: #30876c;
  outline: none;
  background-color: #fff;
}

button {
  padding: 0.8rem;
  border: none;
  border-radius: 8px;
  background-color: #30876c;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

button:hover:not(:disabled) {
  background-color: #276955;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  color: #b00020;
  font-size: 0.9rem;
}

.join-link {
  margin-top: 1.5rem;
  font-size: 0.95rem;
}

.join-link a {
  color: #30876c;
  text-decoration: none;
  font-weight: 600;
}

.join-link a:hover {
  text-decoration: underline;
}
</style>