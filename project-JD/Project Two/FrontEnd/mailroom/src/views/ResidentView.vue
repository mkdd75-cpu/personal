<!-- src/views/ResidentView.vue -->
<!-- Shown after a resident swipes their card.                              -->
<!-- Displays all pending packages and lets them confirm pickup.            -->
<!-- Auto-returns to ScanView after a timeout or when done.                 -->

<template>
  <div class="resident-view">

    <!-- Ambient background grid -->
    <div class="bg-grid" />

    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <span>←</span> Back
      </button>
      <div class="logo-text">MAILROOM</div>
      <div class="session-timer" :class="{ urgent: timeLeft <= 15 }">
        <svg viewBox="0 0 24 24" class="timer-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        {{ timeLeft }}s
      </div>
    </header>

    <!-- User greeting -->
    <section class="greeting" :class="{ visible: loaded }">
      <div class="avatar">{{ initials }}</div>
      <div class="greeting-text">
        <h1>Hey, {{ firstName }}!</h1>
        <p class="unit-tag">Unit {{ user?.unit }}</p>
      </div>
    </section>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="loading-bars">
        <span /><span /><span />
      </div>
      <p>Loading your packages...</p>
    </div>

    <!-- No packages -->
    <section v-else-if="packages.length === 0" class="empty-state" :class="{ visible: loaded }">
      <div class="empty-icon">📭</div>
      <h2>No packages waiting</h2>
      <p>You're all caught up! Check back after your next delivery.</p>
    </section>

    <!-- Package list -->
    <section v-else class="packages-section" :class="{ visible: loaded }">
      <div class="section-header">
        <h2>Packages Ready for Pickup</h2>
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
          <!-- Carrier badge -->
          <div class="carrier-badge" :class="carrierClass(pkg.carrier)">
            {{ carrierIcon(pkg.carrier) }}
          </div>

          <!-- Package info -->
          <div class="pkg-info">
            <div class="pkg-carrier">{{ pkg.carrier }}</div>
            <div class="pkg-tracking" v-if="pkg.trackingNumber">
              {{ pkg.trackingNumber }}
            </div>
            <div class="pkg-arrived">
              Arrived {{ formatDate(pkg.checkedInAt) }}
            </div>
            <div class="pkg-notes" v-if="pkg.notes">
              📝 {{ pkg.notes }}
            </div>
          </div>

          <!-- Pickup action -->
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

      <!-- Bulk pickup -->
      <div class="bulk-action" v-if="pendingCount > 1">
        <button class="bulk-btn" :disabled="!!pickingUp" @click="pickUpAll">
          Pick Up All {{ pendingCount }} Packages
        </button>
      </div>
    </section>

    <!-- All done toast -->
    <transition name="toast">
      <div v-if="allDone" class="all-done-toast">
        ✅ All packages picked up! See you next time, {{ firstName }}.
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserByCardId, getPendingPackagesForResident, checkOutPackage } from '@/services/firestoreService'

const route = useRoute()
const router = useRouter()

// ── Data ───────────────────────────────────────────────────────────────────
const user = ref(null)
const packages = ref([])
const loading = ref(true)
const loaded = ref(false)
const pickingUp = ref(null)
const pickedUp = ref(new Set())
const allDone = ref(false)

// ── Session timeout — auto return to scan after 60s ────────────────────────
const timeLeft = ref(300)
let sessionTimer = null

function startSessionTimer() {
  sessionTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) goBack()
  }, 1000)
}

onUnmounted(() => {
  clearInterval(sessionTimer)
})

// ── Computed ───────────────────────────────────────────────────────────────
const initials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
})

const firstName = computed(() => user.value?.name?.split(' ')[0] ?? '')

const pendingCount = computed(() =>
  packages.value.filter(p => !pickedUp.value.has(p.id)).length
)

// ── Load data ──────────────────────────────────────────────────────────────
onMounted(async () => {
  const cardId = route.params.cardId

  try {
    const [userData, pkgData] = await Promise.all([
      getUserByCardId(cardId),
      getPendingPackagesForResident(cardId),
    ])

    user.value = userData
    packages.value = pkgData
  } catch (err) {
    console.error('[ResidentView] load error:', err)
  } finally {
    loading.value = false
    setTimeout(() => { loaded.value = true }, 50)
    startSessionTimer()
  }
})

// ── Actions ────────────────────────────────────────────────────────────────
async function confirmPickup(pkg) {
  if (pickingUp.value) return
  pickingUp.value = pkg.id

  try {
    await checkOutPackage(pkg.id, route.params.cardId)
    pickedUp.value = new Set([...pickedUp.value, pkg.id])

    // Reset timer — resident is still active
    timeLeft.value = 60

    // Check if all done
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
  for (const pkg of pending) {
    await confirmPickup(pkg)
  }
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
  const diff = now - date
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function carrierIcon(carrier) {
  const icons = { UPS: '🟫', FedEx: '🟪', USPS: '🟦', Amazon: '📦', DHL: '🟨', Other: '📫' }
  return icons[carrier] ?? '📫'
}

function carrierClass(carrier) {
  return carrier?.toLowerCase().replace(/\s/g, '-') ?? 'other'
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

/* ── Base ──────────────────────────────────────────────────────────────── */
.resident-view {
  min-height: 100vh;
  background: #f5f0e8;
  color: #1a1612;
  font-family: 'DM Sans', sans-serif;
  position: relative;
  overflow-x: hidden;
}

.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
  background: rgba(245, 240, 232, 0.9);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: 1px solid rgba(0,0,0,0.15);
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
}
.back-btn:hover { background: rgba(0,0,0,0.05); color: #1a1612; }

.logo-text {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  color: #b5622a;
}

.session-timer {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: 'Syne', sans-serif;
  font-size: 0.85rem;
  color: #888;
  transition: color 0.3s;
}
.session-timer.urgent { color: #c0392b; animation: pulse-text 1s ease-in-out infinite; }
.timer-icon { width: 16px; height: 16px; }
@keyframes pulse-text { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ── Greeting ──────────────────────────────────────────────────────────── */
.greeting {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem 2rem 1.5rem;
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.greeting.visible { opacity: 1; transform: translateY(0); }

.avatar {
  width: 56px; height: 56px;
  border-radius: 14px;
  background: #b5622a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.greeting-text h1 {
  font-family: 'Syne', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 0.2rem;
}
.unit-tag {
  font-size: 0.85rem;
  color: #888;
  letter-spacing: 0.05em;
}

/* ── Loading ───────────────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: #aaa;
  position: relative;
  z-index: 1;
}
.loading-bars {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 28px;
}
.loading-bars span {
  width: 5px;
  background: #b5622a;
  border-radius: 3px;
  animation: bar-bounce 0.8s ease-in-out infinite;
}
.loading-bars span:nth-child(1) { animation-delay: 0s; }
.loading-bars span:nth-child(2) { animation-delay: 0.15s; }
.loading-bars span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bar-bounce {
  0%, 100% { height: 8px; }
  50%       { height: 24px; }
}

/* ── Empty ─────────────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 5rem 2rem;
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
}
.empty-state.visible { opacity: 1; transform: translateY(0); }
.empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
.empty-state h2 { font-family: 'Syne', sans-serif; font-size: 1.4rem; margin-bottom: 0.5rem; }
.empty-state p { color: #888; font-size: 0.9rem; }

/* ── Packages ──────────────────────────────────────────────────────────── */
.packages-section {
  padding: 0 2rem 6rem;
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
}
.packages-section.visible { opacity: 1; transform: translateY(0); }

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.section-header h2 {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #555;
  text-transform: uppercase;
}
.count-badge {
  background: #b5622a;
  color: white;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.55rem;
  border-radius: 20px;
}

/* ── Package card ──────────────────────────────────────────────────────── */
.package-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.package-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1px solid rgba(0,0,0,0.07);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.package-card:hover { border-color: rgba(181,98,42,0.3); box-shadow: 0 2px 12px rgba(181,98,42,0.08); }

@keyframes slide-in {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}

.package-card.picking-up { opacity: 0.6; }

.package-card.picked-up {
  background: #f0faf4;
  border-color: #b7e4c7;
}

.carrier-badge {
  font-size: 1.75rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f0e8;
  border-radius: 10px;
  flex-shrink: 0;
}

.pkg-info {
  flex: 1;
  min-width: 0;
}
.pkg-carrier {
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
}
.pkg-tracking {
  font-size: 0.75rem;
  color: #999;
  font-family: monospace;
  margin-top: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pkg-arrived {
  font-size: 0.78rem;
  color: #aaa;
  margin-top: 0.2rem;
}
.pkg-notes {
  font-size: 0.78rem;
  color: #b5622a;
  margin-top: 0.2rem;
}

.pkg-action { flex-shrink: 0; }

.pickup-btn {
  background: #1a1612;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 80px;
  justify-content: center;
}
.pickup-btn:hover:not(:disabled) { background: #b5622a; }
.pickup-btn:active:not(:disabled) { transform: scale(0.97); }
.pickup-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.done-check {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #2ecc71;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  animation: pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes pop {
  0%   { transform: scale(0); }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* ── Bulk action ───────────────────────────────────────────────────────── */
.bulk-action {
  margin-top: 1.25rem;
  display: flex;
  justify-content: center;
}
.bulk-btn {
  background: #b5622a;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.8rem 2rem;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: background 0.15s, transform 0.1s;
}
.bulk-btn:hover:not(:disabled) { background: #943f12; }
.bulk-btn:active:not(:disabled) { transform: scale(0.98); }
.bulk-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── All done toast ────────────────────────────────────────────────────── */
.all-done-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1612;
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  z-index: 100;
  white-space: nowrap;
}

.toast-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>