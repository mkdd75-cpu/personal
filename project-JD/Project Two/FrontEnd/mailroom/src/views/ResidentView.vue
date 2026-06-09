<!-- src/views/ResidentView.vue -->


<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { subscribeToUser, subscribeToPendingPackagesForResident, checkOutPackage } from '@/services/firestoreService'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// ── Data ───────────────────────────────────────────────────────────────────
const user = ref(auth.user) // pre-populated from store immediately
const packages = ref([])
const loading = ref(true)
const loaded = ref(false)
const greetingVisible = ref(!!auth.user)
const pickingUp = ref(null)
const pickedUp = ref(new Set())
const allDone = ref(false)

// ── Display values — store provides instant name, listener keeps it live ──
const fullName = computed(() => user.value?.name ?? auth.displayName)
const displayUnit = computed(() => user.value?.unit ?? auth.unit)

const initials = computed(() => {
  const name = fullName.value
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
})

const pendingCount = computed(() =>
  packages.value.filter(p => !pickedUp.value.has(p.id)).length
)

// ── Session timer ──────────────────────────────────────────────────────────
const timeLeft = ref(60)
let sessionTimer = null

function startSessionTimer() {
  sessionTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) goBack()
  }, 1000)
}

// ── Listeners ──────────────────────────────────────────────────────────────
let unsubUser = null
let unsubPackages = null

onMounted(() => {
  const cardId = route.params.cardId

  // Start session timer immediately — always counts down regardless of packages
  startSessionTimer()

  // Subscribe to user document — keeps name/unit live if admin edits profile
  unsubUser = subscribeToUser(cardId,
    (userData) => {
      user.value = userData
      greetingVisible.value = true
    },
    (err) => console.error('[ResidentView] user listener error:', err)
  )

  // Subscribe to pending packages
  unsubPackages = subscribeToPendingPackagesForResident(cardId,
    (pkgData) => {
      packages.value = pkgData
      loading.value = false
      setTimeout(() => { loaded.value = true }, 50)
    },
    (err) => {
      console.error('[ResidentView] packages listener error:', err)
      loading.value = false
      setTimeout(() => { loaded.value = true }, 50)
    }
  )
})

onUnmounted(() => {
  clearInterval(sessionTimer)
  unsubUser?.()
  unsubPackages?.()
})

// ── Actions ────────────────────────────────────────────────────────────────
async function confirmPickup(pkg) {
  if (pickingUp.value) return
  pickingUp.value = pkg.id
  try {
    await checkOutPackage(pkg.id, route.params.cardId)
    pickedUp.value = new Set([...pickedUp.value, pkg.id])
    timeLeft.value = 60
    if (pickedUp.value.size === packages.value.length) {
      allDone.value = true
      setTimeout(() => goBack(), 3000)
    }
  } catch (err) {
    console.error('[ResidentView] checkout error:', err)
  } finally {
    pickingUp.value = null
  }
}

async function pickUpAll() {
  const pending = packages.value.filter(p => !pickedUp.value.has(p.id))
  for (const pkg of pending) await confirmPickup(pkg)
}

function goBack() {
  clearInterval(sessionTimer)
  router.push({ name: 'scan' })
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return 'recently'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const days = Math.floor((now - date) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function carrierIcon(carrier) {
  const icons = { UPS: '🟫', FedEx: '🟪', USPS: '🟦', Amazon: '📦', DHL: '🟨', Other: '📫' }
  return icons[carrier] ?? '📫'
}
</script>

<template>
  <div class="resident-view">
    <div class="pulse-bg" />

    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="goBack">← Back</button>
      <div class="logo">
        <span class="logo-icon">📬</span>
        <span class="logo-text">MAILROOM</span>
      </div>
      <div class="session-timer" :class="{ urgent: timeLeft <= 15 }">
        <svg viewBox="0 0 24 24" class="timer-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        {{ timeLeft }}s
      </div>
    </header>

    <!-- Greeting — shows immediately from router state, no Firestore wait -->
    <section class="greeting" :class="{ visible: greetingVisible }">
      <div class="avatar">{{ initials }}</div>
      <div class="greeting-text">
        <h1>Hey, {{ fullName }}!</h1>
        <p class="unit-tag">Unit {{ displayUnit }}</p>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-bars"><span /><span /><span /></div>
      <p>Loading your packages...</p>
    </div>

    <!-- No packages -->
    <section v-else-if="packages.length === 0" class="empty-state" :class="{ visible: loaded }">
      <div class="empty-icon">📭</div>
      <h2>No packages available</h2>
      <p>You have no packages to pick up right now.</p>
    </section>

    <!-- Package list -->
    <section v-else class="packages-section" :class="{ visible: loaded }">
      <div class="section-header">
        <h2>Ready for Pickup</h2>
        <span class="count-badge">{{ packages.length }}</span>
      </div>

      <ul class="package-list">
        <li
          v-for="(pkg, i) in packages"
          :key="pkg.id"
          class="package-card"
          :class="{ 'picking-up': pickingUp === pkg.id, 'picked-up': pickedUp.has(pkg.id) }"
          :style="{ animationDelay: `${i * 80}ms` }"
        >
          <div class="carrier-badge">{{ carrierIcon(pkg.carrier) }}</div>

          <div class="pkg-info">
            <div class="pkg-carrier">{{ pkg.carrier }}</div>
            <div class="pkg-tracking" v-if="pkg.trackingNumber">{{ pkg.trackingNumber }}</div>
            <div class="pkg-arrived">Arrived {{ formatDate(pkg.checkedInAt) }}</div>
            <div class="pkg-notes" v-if="pkg.notes">📝 {{ pkg.notes }}</div>
          </div>

          <div class="pkg-action">
            <div v-if="pickedUp.has(pkg.id)" class="done-check">✓</div>
            <button
              v-else
              class="pickup-btn"
              :disabled="pickingUp === pkg.id"
              @click="confirmPickup(pkg)"
            >
              <span v-if="pickingUp === pkg.id" class="btn-spinner" />
              <span v-else>Pick Up</span>
            </button>
          </div>
        </li>
      </ul>

      <div class="bulk-action" v-if="pendingCount > 1">
        <button class="bulk-btn" :disabled="!!pickingUp" @click="pickUpAll">
          Pick Up All {{ pendingCount }} Packages
        </button>
      </div>
    </section>

    <!-- All done toast -->
    <transition name="toast">
      <div v-if="allDone" class="all-done-toast">
        ✅ All picked up! See you next time, {{ fullName }}.
      </div>
    </transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');

/* ── Base ──────────────────────────────────────────────────────────────── */
.resident-view {
  min-height: 100vh;
  background: #0a0e17;
  color: #e0e8f0;
  font-family: 'IBM Plex Sans', sans-serif;
  position: relative;
  overflow-x: hidden;
}

.pulse-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 80% 20%, rgba(100,180,255,0.04) 0%, transparent 70%),
    radial-gradient(ellipse 50% 50% at 20% 80%, rgba(45,184,122,0.03) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(10,14,23,0.9);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 0.4rem 0.9rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.05em;
}
.back-btn:hover { border-color: #64b4ff; color: #64b4ff; }

.logo { display: flex; align-items: center; gap: 0.6rem; }
.logo-icon { font-size: 1.2rem; }
.logo-text {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600; font-size: 0.9rem;
  letter-spacing: 0.25em; color: #64b4ff;
}

.session-timer {
  display: flex; align-items: center; gap: 0.35rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85rem; color: rgba(255,255,255,0.3);
  transition: color 0.3s;
}
.session-timer.urgent { color: #f87171; animation: pulse-text 1s ease-in-out infinite; }
.timer-icon { width: 15px; height: 15px; }
@keyframes pulse-text { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ── Greeting ──────────────────────────────────────────────────────────── */
.greeting {
  display: flex; align-items: center; gap: 1.25rem;
  padding: 2rem 2rem 1.5rem;
  position: relative; z-index: 1;
  opacity: 0; transform: translateY(12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.greeting.visible { opacity: 1; transform: translateY(0); }

.avatar {
  width: 54px; height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a4a3a, #0d2e24);
  border: 2px solid #2db87a;
  display: flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600; font-size: 1.1rem;
  color: #2db87a; flex-shrink: 0;
}

.greeting-text h1 {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 1.75rem; font-weight: 600;
  color: #e0f8ee; line-height: 1.1; margin: 0 0 0.2rem;
}
.unit-tag {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem; color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
}

/* ── Loading ───────────────────────────────────────────────────────────── */
.loading-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 1rem; padding: 4rem 2rem;
  color: rgba(255,255,255,0.3);
  position: relative; z-index: 1;
}
.loading-bars { display: flex; gap: 6px; align-items: flex-end; height: 28px; }
.loading-bars span {
  width: 4px; background: #64b4ff; border-radius: 3px;
  animation: bar-bounce 0.8s ease-in-out infinite;
}
.loading-bars span:nth-child(2) { animation-delay: 0.15s; }
.loading-bars span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bar-bounce { 0%,100% { height: 8px; } 50% { height: 24px; } }

/* ── Empty ─────────────────────────────────────────────────────────────── */
.empty-state {
  text-align: center; padding: 5rem 2rem;
  position: relative; z-index: 1;
  opacity: 0; transform: translateY(12px);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
}
.empty-state.visible { opacity: 1; transform: translateY(0); }
.empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
.empty-state h2 {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 1.4rem; font-weight: 600; color: #e0e8f0; margin-bottom: 0.5rem;
}
.empty-state p { color: rgba(255,255,255,0.3); font-size: 0.9rem; }

/* ── Packages ──────────────────────────────────────────────────────────── */
.packages-section {
  padding: 0 2rem 6rem;
  position: relative; z-index: 1;
  opacity: 0; transform: translateY(12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
}
.packages-section.visible { opacity: 1; transform: translateY(0); }

.section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.section-header h2 {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem; font-weight: 600;
  letter-spacing: 0.15em; color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}
.count-badge {
  background: #64b4ff; color: #0a0e17;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 700; font-size: 0.72rem;
  padding: 0.15rem 0.55rem; border-radius: 20px;
}

/* ── Package card ──────────────────────────────────────────────────────── */
.package-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }

.package-card {
  display: flex; align-items: center; gap: 1rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: border-color 0.2s;
}
.package-card:hover { border-color: rgba(100,180,255,0.2); }
@keyframes slide-in { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }

.package-card.picking-up { opacity: 0.5; }
.package-card.picked-up  { background: rgba(45,184,122,0.06); border-color: rgba(45,184,122,0.2); }

.carrier-badge {
  font-size: 1.75rem; width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.05);
  border-radius: 10px; flex-shrink: 0;
}

.pkg-info { flex: 1; min-width: 0; }
.pkg-carrier {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600; font-size: 0.95rem; color: #e0e8f0;
}
.pkg-tracking {
  font-size: 0.72rem; color: rgba(255,255,255,0.3);
  font-family: 'IBM Plex Mono', monospace;
  margin-top: 0.15rem; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.pkg-arrived { font-size: 0.75rem; color: rgba(255,255,255,0.25); margin-top: 0.2rem; }
.pkg-notes   { font-size: 0.75rem; color: #64b4ff; margin-top: 0.2rem; }

.pkg-action { flex-shrink: 0; }

.pickup-btn {
  background: #2db87a; color: #071410;
  border: none; border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600; font-size: 0.8rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  display: flex; align-items: center; gap: 0.4rem;
  min-width: 80px; justify-content: center;
}
.pickup-btn:hover:not(:disabled) { background: #3dd68c; }
.pickup-btn:active:not(:disabled) { transform: scale(0.97); }
.pickup-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(7,20,16,0.3);
  border-top-color: #071410;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.done-check {
  width: 36px; height: 36px; border-radius: 50%;
  background: #2db87a; color: #071410;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700;
  animation: pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }

/* ── Bulk action ───────────────────────────────────────────────────────── */
.bulk-action { margin-top: 1.25rem; display: flex; justify-content: center; }
.bulk-btn {
  background: rgba(100,180,255,0.1);
  color: #64b4ff;
  border: 1px solid rgba(100,180,255,0.25);
  border-radius: 10px;
  padding: 0.8rem 2rem;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600; font-size: 0.82rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
}
.bulk-btn:hover:not(:disabled) { background: rgba(100,180,255,0.18); border-color: #64b4ff; }
.bulk-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Toast ─────────────────────────────────────────────────────────────── */
.all-done-toast {
  position: fixed; bottom: 2rem; left: 50%;
  transform: translateX(-50%);
  background: #0d2e24;
  border: 1px solid #2db87a;
  color: #e0f8ee;
  padding: 1rem 2rem; border-radius: 12px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.82rem; font-weight: 600;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 100; white-space: nowrap;
}

.toast-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>