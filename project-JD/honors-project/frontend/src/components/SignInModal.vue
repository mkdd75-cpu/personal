<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const userStore = useUserStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)
const showPassword = ref(false)

function close() {
  emit('update:modelValue', false)
  email.value = ''
  password.value = ''
  errorMessage.value = ''
  loading.value = false
}

// Close on Escape key
function onKeydown(e) {
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// Reset error when user types
watch([email, password], () => { errorMessage.value = '' })

async function handleLogin() {
  errorMessage.value = ''

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Please enter both your email and password.'
    return
  }

  loading.value = true

  try {
    const response = await fetch(apiUrl('/user/signin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: password.value }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password.')
    }

    userStore.setAuth(data.token, data.user)
    close()
    router.push('/main')
  } catch (err) {
    errorMessage.value = err.message || 'Sign in failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="backdrop" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-brand">
              <img src="/Nkwapa Watch (3).png" alt="Nkwapa Health" class="modal-logo" />
              <span class="modal-title" id="modal-title">Sign In</span>
            </div>
            <button class="close-btn" @click="close" aria-label="Close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <p class="modal-sub">Welcome back to Nkwapa Health</p>

            <!-- Error -->
            <div v-if="errorMessage" class="error-box">
              <span class="material-symbols-outlined" style="font-size:16px;flex-shrink:0">error</span>
              {{ errorMessage }}
            </div>

            <!-- Email -->
            <div class="field">
              <label for="signin-email">Email address</label>
              <input
                id="signin-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                @keyup.enter="handleLogin"
                :disabled="loading"
              />
            </div>

            <!-- Password -->
            <div class="field">
              <label for="signin-password">Password</label>
              <div class="pw-wrap">
                <input
                  id="signin-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  @keyup.enter="handleLogin"
                  :disabled="loading"
                />
                <button
                  type="button"
                  class="pw-toggle"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>

            <!-- Submit -->
            <button
              class="signin-btn"
              @click="handleLogin"
              :disabled="loading"
            >
              <span v-if="loading" class="spinner"></span>
              <span>{{ loading ? 'Signing in…' : 'Sign In' }}</span>
            </button>

            <!-- Divider -->
            <div class="divider"><span>or</span></div>

            <!-- Join link -->
            <p class="join-prompt">
              Don't have an account?
              <RouterLink to="/joinus" @click="close" class="join-link">Join Us</RouterLink>
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ───────────────────────────────────────────────────────────────── */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* ── Modal ──────────────────────────────────────────────────────────────────── */
.modal {
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  border-top: 4px solid var(--green);
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 1.4rem 1rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-logo {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 2px solid var(--green-200);
  object-fit: cover;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--green);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--gray-500);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

.close-btn .material-symbols-outlined { font-size: 20px; }

/* ── Body ───────────────────────────────────────────────────────────────────── */
.modal-body {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-sub {
  font-size: 0.88rem;
  color: var(--gray-500);
  margin: -0.25rem 0 0.25rem;
}

/* ── Error ──────────────────────────────────────────────────────────────────── */
.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--error-bg);
  color: var(--error);
  border: 1px solid #f5c2c2;
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.9rem;
  font-size: 0.88rem;
  line-height: 1.5;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* ── Fields ─────────────────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gray-700);
}

.field input {
  font-size: 0.95rem;
}

.pw-wrap {
  position: relative;
}

.pw-wrap input {
  padding-right: 2.6rem;
  width: 100%;
}

.pw-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--gray-400);
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.pw-toggle:hover { color: var(--green); }
.pw-toggle .material-symbols-outlined { font-size: 18px; }

/* ── Submit button ──────────────────────────────────────────────────────────── */
.signin-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--green);
  color: var(--white);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;
  font-family: var(--font);
  margin-top: 0.25rem;
}

.signin-btn:hover:not(:disabled) { background: var(--green-700); }
.signin-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Spinner ─────────────────────────────────────────────────────────────────  */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Divider ─────────────────────────────────────────────────────────────────  */
.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--gray-400);
  font-size: 0.82rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--gray-200);
}

/* ── Join link ───────────────────────────────────────────────────────────────  */
.join-prompt {
  text-align: center;
  font-size: 0.88rem;
  color: var(--gray-600);
}

.join-link {
  color: var(--green);
  font-weight: 600;
  text-decoration: none;
}

.join-link:hover { text-decoration: underline; }

/* ── Transition ─────────────────────────────────────────────────────────────── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.22s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: translateY(-16px) scale(0.97);
  opacity: 0;
}

.modal-leave-to .modal {
  transform: translateY(8px) scale(0.97);
  opacity: 0;
}
</style>