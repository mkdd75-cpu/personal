<!-- src/views/ScanView.vue -->
<template>
  <div class="scan-view" :class="stateClass">
    <div class="pulse-ring" :class="{ active: state === 'scanning' }" />

    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">📬</span>
        <span class="logo-text">MAILROOM</span>
      </div>
      <div class="clock">{{ currentTime }}</div>
    </header>

    <!-- Main -->
    <main class="main">

      <!-- IDLE: swipe prompt + manual login options -->
      <transition name="fade">
        <div v-if="state === 'idle' && !showManual" class="idle-screen">
          <div class="card-icon">
            <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="78" height="54" rx="7" stroke="currentColor" stroke-width="2"/>
              <rect x="1" y="14" width="78" height="12" fill="currentColor" opacity="0.15"/>
              <rect x="10" y="34" width="28" height="4" rx="2" fill="currentColor" opacity="0.4"/>
              <rect x="10" y="42" width="18" height="4" rx="2" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
          <h1 class="idle-title">Swipe Your Card</h1>
          <p class="idle-subtitle">to check in or pick up a package</p>
          <div class="swipe-indicator">
            <span /><span /><span />
          </div>
          <div class="divider">
            <span class="divider-line" /><span class="divider-text">or sign in manually</span><span class="divider-line" />
          </div>
          <button class="manual-open-btn" @click="openManual">
            Sign In with Email
          </button>
        </div>
      </transition>

      <!-- MANUAL SIGN IN PANEL -->
      <transition name="slide-up">
        <div v-if="state === 'idle' && showManual" class="manual-screen">
          <div class="manual-card">
            <div class="manual-header">
              <div class="manual-title">📧 Sign In</div>
              <button class="manual-back" @click="closeManual">✕</button>
            </div>

            <p class="manual-hint">Enter your email and the last 4 digits of your card</p>

            <div class="manual-fields">
              <div class="manual-field">
                <label class="manual-label">Email Address</label>
                <input
                  ref="manualInputRef"
                  v-model="manualEmail"
                  class="manual-input"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="off"
                  @keydown.enter="focusLast4"
                />
              </div>
              <div class="manual-field">
                <label class="manual-label">Last 4 Digits of Card</label>
                <input
                  ref="last4Ref"
                  v-model="manualLast4"
                  class="manual-input manual-input-short"
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder="1234"
                  @keydown.enter="submitManual"
                />
              </div>
            </div>

            <button
              class="manual-submit-btn"
              :disabled="!canSubmitManual || manualLoading"
              @click="submitManual"
            >
              <span v-if="manualLoading" class="mini-spin" />
              <span v-else>Continue →</span>
            </button>

            <p v-if="manualError" class="manual-error">{{ manualError }}</p>

            <p class="manual-swipe-hint">
              💳 Or just swipe your card — the reader is still active
            </p>
          </div>
        </div>
      </transition>

      <!-- SCANNING -->
      <transition name="fade">
        <div v-if="state === 'scanning'" class="scanning-screen">
          <div class="spinner" />
          <p>Reading card...</p>
        </div>
      </transition>

      <!-- FOUND -->
      <transition name="slide-up">
        <div v-if="state === 'found' && foundUser" class="found-screen">
          <div class="avatar">{{ initials }}</div>
          <h2 class="found-name">{{ foundUser.name }}</h2>
          <p class="found-unit">Unit {{ foundUser.unit }}</p>
          <div class="found-badge" :class="foundUser.role">{{ foundUser.role }}</div>
          <p class="found-redirect">Redirecting...</p>
        </div>
      </transition>

      <!-- NOT FOUND -->
      <transition name="fade">
        <div v-if="state === 'not-found'" class="notfound-screen">
          <div class="notfound-icon">⚠️</div>
          <h2>Card Not Recognized</h2>
          <p>This card is not registered in the system.</p>
          <p class="notfound-hint">Please see mailroom staff to register your card.</p>
          <div class="countdown-bar"><div class="countdown-fill" :style="{ width: countdownWidth + '%' }" /></div>
        </div>
      </transition>

      <!-- ERROR -->
      <transition name="fade">
        <div v-if="state === 'error'" class="error-screen">
          <div class="error-icon">✕</div>
          <h2>Read Error</h2>
          <p>{{ errorMessage }}</p>
          <p class="notfound-hint">Please try again.</p>
        </div>
      </transition>

    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="listener-status" :class="{ active: isListening }">
        <span class="status-dot" />
        {{ isListening ? 'Reader Active' : 'Reader Inactive' }}
      </div>
      <div class="footer-date">{{ currentDate }}</div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCardReader } from '@/composables/useCardReader'
import { getUserByCardId, getUserByEmail } from '@/services/firestoreService'

const router = useRouter()

// ── State ──────────────────────────────────────────────────────────────────
const state = ref('idle')
const foundUser = ref(null)
const errorMessage = ref('')
const countdownWidth = ref(100)

// ── Manual sign in ─────────────────────────────────────────────────────────
const showManual = ref(false)
const manualEmail = ref('')
const manualLast4 = ref('')
const manualLoading = ref(false)
const manualError = ref('')
const manualInputRef = ref(null)
const last4Ref = ref(null)

const canSubmitManual = computed(() =>
  manualEmail.value.trim().length > 3 &&
  manualLast4.value.trim().length === 4
)

function openManual() {
  manualEmail.value = ''
  manualLast4.value = ''
  manualError.value = ''
  showManual.value = true
  nextTick(() => manualInputRef.value?.focus())
}

function closeManual() {
  showManual.value = false
  manualEmail.value = ''
  manualLast4.value = ''
  manualError.value = ''
}

function focusLast4() {
  last4Ref.value?.focus()
}

async function submitManual() {
  if (!canSubmitManual.value || manualLoading.value) return

  manualLoading.value = true
  manualError.value = ''

  try {
    // 1. Look up by email
    const user = await getUserByEmail(manualEmail.value)

    if (!user) {
      manualError.value = 'No account found with that email address.'
      manualLoading.value = false
      return
    }

    // 2. Check last 4 digits of their registered card
    const cardLast4 = user.cardId?.slice(-4)
    if (cardLast4 !== manualLast4.value.trim()) {
      manualError.value = 'Card digits do not match. Please try again.'
      manualLoading.value = false
      return
    }

    // 3. Check account is active
    if (user.active === false) {
      manualError.value = 'This account has been deactivated. Please see staff.'
      manualLoading.value = false
      return
    }

    // Success
    showManual.value = false
    manualLoading.value = false
    foundUser.value = user
    state.value = 'found'
    setTimeout(() => routeUser(user), 1800)

  } catch (err) {
    console.error('[ScanView] manual login error:', err)
    manualError.value = 'Connection error. Please try again.'
    manualLoading.value = false
  }
}

// ── Routing ────────────────────────────────────────────────────────────────
function routeUser(user) {
  if (user.role === 'resident') {
    router.push({
      name: 'resident',
      params: { cardId: user.id },
      state: { userName: user.name, userUnit: user.unit }
    })
  } else if (user.role === 'staff' ) {
    router.push({ name: 'staff-dashboard' })
  } else if (user.role === 'admin') {
    router.push({ name: 'admin' })
  }
}

// ── Clock ──────────────────────────────────────────────────────────────────
const currentTime = ref('')
const currentDate = ref('')
let clockInterval = null

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  currentDate.value = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

onMounted(() => { updateClock(); clockInterval = setInterval(updateClock, 1000) })
onUnmounted(() => { clearInterval(clockInterval); clearTimeout(resetTimer); clearInterval(countdownInterval) })

// ── Computed ───────────────────────────────────────────────────────────────
const initials = computed(() => {
  if (!foundUser.value?.name) return '?'
  return foundUser.value.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
})

const stateClass = computed(() => ({
  'state-found': state.value === 'found',
  'state-error': state.value === 'error' || state.value === 'role-mismatch',
  'state-scanning': state.value === 'scanning',
}))

// ── Reset ──────────────────────────────────────────────────────────────────
let resetTimer = null
let countdownInterval = null

function resetToIdle(delay = 3000) {
  clearTimeout(resetTimer)
  clearInterval(countdownInterval)
  countdownWidth.value = 100

  const steps = delay / 50
  let step = 0
  countdownInterval = setInterval(() => {
    step++
    countdownWidth.value = 100 - (step / steps) * 100
    if (step >= steps) clearInterval(countdownInterval)
  }, 50)

  resetTimer = setTimeout(() => {
    state.value = 'idle'
    foundUser.value = null
    errorMessage.value = ''
    countdownWidth.value = 100
  }, delay)
}

// ── Card swipe handler ─────────────────────────────────────────────────────
const { isListening } = useCardReader({
  onSwipe: async ({ cardId }) => {
    if (state.value === 'scanning' || state.value === 'found') return

    // If manual panel is open, close it and proceed with the swipe normally
    if (showManual.value) closeManual()

    state.value = 'scanning'
    foundUser.value = null

    try {
      const user = await getUserByCardId(cardId)
      if (!user) { state.value = 'not-found'; resetToIdle(4000); return }
      foundUser.value = user
      state.value = 'found'
      setTimeout(() => routeUser(user), 1800)
    } catch (err) {
      errorMessage.value = err.message || 'Could not connect. Please try again.'
      state.value = 'error'
      resetToIdle(4000)
    }
  },
  onError: (msg) => {
    errorMessage.value = msg
    state.value = 'error'
    resetToIdle(4000)
  },
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');

.scan-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0e17;
  color: #e0e8f0;
  font-family: 'IBM Plex Sans', sans-serif;
  position: relative;
  overflow: hidden;
  transition: background 0.4s ease;
}
.scan-view.state-found    { background: #071410; }
.scan-view.state-error    { background: #130a0a; }
.scan-view.state-scanning { background: #090d1a; }

.pulse-ring {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 600px; height: 600px;
  border-radius: 50%;
  border: 1px solid rgba(100,180,255,0.08);
  pointer-events: none;
}
.pulse-ring.active { animation: pulse 1s ease-out infinite; }
@keyframes pulse {
  0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.5; }
  100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; }
}

/* Header */
.header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.5rem 2.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  z-index: 1;
}
.logo { display: flex; align-items: center; gap: 0.75rem; }
.logo-icon { font-size: 1.4rem; }
.logo-text {
  font-family: 'IBM Plex Mono', monospace; font-weight: 600;
  font-size: 1rem; letter-spacing: 0.25em; color: #64b4ff;
}
.clock { font-family: 'IBM Plex Mono', monospace; font-size: 1.5rem; color: rgba(255,255,255,0.4); }

/* Main */
.main { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }

/* Idle */
.idle-screen {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 1rem;
}
.card-icon {
  width: 100px; color: rgba(100,180,255,0.5); margin-bottom: 0.5rem;
  animation: float 3s ease-in-out infinite;
}
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

.idle-title { font-size: 2.5rem; font-weight: 300; letter-spacing: 0.05em; color: #e0e8f0; margin: 0; }
.idle-subtitle { font-size: 1rem; color: rgba(255,255,255,0.35); margin: 0; letter-spacing: 0.05em; }

.swipe-indicator { display: flex; gap: 8px; margin-top: 0.5rem; }
.swipe-indicator span {
  width: 6px; height: 6px; border-radius: 50%; background: #64b4ff; opacity: 0.3;
  animation: blink 1.5s ease-in-out infinite;
}
.swipe-indicator span:nth-child(2) { animation-delay: 0.3s; }
.swipe-indicator span:nth-child(3) { animation-delay: 0.6s; }
@keyframes blink { 0%,100% { opacity: 0.2; } 50% { opacity: 0.8; } }

/* Divider */
.divider {
  display: flex; align-items: center; gap: 0.75rem;
  width: 320px; margin-top: 0.5rem;
}
.divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
.divider-text { font-size: 0.72rem; color: rgba(255,255,255,0.25); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }

/* Manual open button */
.manual-open-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  color: rgba(255,255,255,0.5);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  padding: 0.65rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}
.manual-open-btn:hover {
  background: rgba(255,255,255,0.09);
  border-color: #64b4ff;
  color: #64b4ff;
}

/* Manual sign in screen */
.manual-screen {
  display: flex; align-items: center; justify-content: center; width: 100%;
}
.manual-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 2rem;
  width: 400px;
  display: flex; flex-direction: column; gap: 1.25rem;
}

.manual-header { display: flex; justify-content: space-between; align-items: center; }
.manual-title {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e0e8f0;
  letter-spacing: 0.05em;
}

.manual-back {
  background: none; border: none; color: rgba(255,255,255,0.3);
  font-size: 1rem; cursor: pointer; padding: 0.25rem 0.5rem;
  border-radius: 4px; transition: color 0.15s;
}
.manual-back:hover { color: white; }

.manual-hint { font-size: 0.82rem; color: rgba(255,255,255,0.35); margin: 0; }

.manual-fields { display: flex; flex-direction: column; gap: 0.85rem; }
.manual-field { display: flex; flex-direction: column; gap: 0.35rem; }
.manual-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.manual-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: #e0e8f0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}
.manual-input:focus { border-color: #64b4ff; background: rgba(100,180,255,0.04); }
.manual-input::placeholder { color: rgba(255,255,255,0.18); }
.manual-input-short { letter-spacing: 0.3em; font-size: 1.1rem; text-align: center; }

.manual-submit-btn {
  background: #64b4ff;
  border: none;
  border-radius: 8px;
  padding: 0.8rem;
  color: #0a0e17;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  display: flex; align-items: center; justify-content: center;
  gap: 0.5rem;
  width: 100%;
}
.manual-submit-btn:hover:not(:disabled) { background: #89caff; }
.manual-submit-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.manual-error {
  font-size: 0.8rem; color: #f87171;
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin: 0;
}

.manual-swipe-hint {
  font-size: 0.72rem; color: rgba(255,255,255,0.18);
  text-align: center; margin: 0;
}

.mini-spin {
  width: 14px; height: 14px;
  border: 2px solid rgba(10,14,23,0.3);
  border-top-color: #0a0e17;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

/* Scanning */
.scanning-screen {
  text-align: center; color: rgba(255,255,255,0.5);
  display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
}
.spinner {
  width: 48px; height: 48px;
  border: 2px solid rgba(100,180,255,0.2);
  border-top-color: #64b4ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Found */
.found-screen { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #1a4a3a, #0d2e24);
  border: 2px solid #2db87a;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: 600; color: #2db87a; margin-bottom: 0.5rem;
}
.found-name { font-size: 2rem; font-weight: 600; margin: 0; color: #e0f8ee; }
.found-unit { font-family: 'IBM Plex Mono', monospace; font-size: 0.9rem; color: rgba(255,255,255,0.4); margin: 0; }
.found-badge {
  font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem;
  letter-spacing: 0.15em; text-transform: uppercase;
  padding: 0.25rem 0.75rem; border-radius: 20px; border: 1px solid;
}
.found-badge.resident { color: #2db87a; border-color: #2db87a; background: rgba(45,184,122,0.1); }
.found-badge.staff    { color: #64b4ff; border-color: #64b4ff; background: rgba(100,180,255,0.1); }
.found-badge.admin    { color: #f0b429; border-color: #f0b429; background: rgba(240,180,41,0.1); }
.found-redirect { font-size: 0.8rem; color: rgba(255,255,255,0.25); margin-top: 0.5rem; animation: blink 1s ease-in-out infinite; }

/* Not found / mismatch / error */
.notfound-screen, .error-screen {
  text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}
.notfound-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.error-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(220,60,60,0.15); border: 2px solid #dc3c3c;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; color: #dc3c3c; font-style: normal; margin-bottom: 0.5rem;
}
.notfound-hint { font-size: 0.85rem; color: rgba(255,255,255,0.3); margin-top: 0.25rem; }
.countdown-bar { width: 200px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 1.5rem; overflow: hidden; }
.countdown-fill { height: 100%; background: #64b4ff; transition: width 0.05s linear; }

/* Footer */
.footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 2.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  z-index: 1;
}
.listener-status { display: flex; align-items: center; gap: 0.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: rgba(255,255,255,0.25); }
.listener-status.active { color: #2db87a; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.listener-status.active .status-dot { animation: blink 2s ease-in-out infinite; }
.footer-date { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: rgba(255,255,255,0.2); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from   { opacity: 0; transform: translateY(20px); }
.slide-up-leave-to     { opacity: 0; transform: translateY(-10px); }
</style>