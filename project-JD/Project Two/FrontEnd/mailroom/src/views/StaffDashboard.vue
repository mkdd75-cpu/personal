<!-- src/views/StaffDashboard.vue -->

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  checkInPackage,
  checkOutPackage,
  subscribeToAllPendingPackages,
  subscribeToAllUsers,
  subscribeToRecentPackages,
} from '@/services/firestoreService'
import { useAuthStore } from '@/stores/auth'
import { CARRIERS } from '@/models'

const router = useRouter()
const auth = useAuthStore()

// ── Redirect unauthenticated users back to scanner ─────────────────────────
if (!auth.isLoggedIn) {
  router.replace({ name: 'scan' })
}

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'queue',   label: 'Package Queue',  icon: '⬛' },
  { id: 'log',     label: 'Log Package',    icon: '＋' },
  { id: 'history', label: 'History',        icon: '◷'  },
]
const activeTab = ref('queue')
const currentTab = computed(() => tabs.find(t => t.id === activeTab.value))

// ── Data ───────────────────────────────────────────────────────────────────
const pendingPackages = ref([])
const historyPackages = ref([])
const allUsers = ref([])
const loadingQueue = ref(true)
const loadingHistory = ref(true)
const checkingOut = ref(null)
const recentlyLogged = ref([])
const submitting = ref(false)
const successMsg = ref('')

// ── Listeners ──────────────────────────────────────────────────────────────
let unsubQueue = null
let unsubHistory = null
let unsubUsers = null

onMounted(() => {
  // Live queue — updates instantly when staff logs a package or resident picks up
  unsubQueue = subscribeToAllPendingPackages(
    (pkgs) => { pendingPackages.value = pkgs; loadingQueue.value = false },
    (err) => { console.error('[StaffDashboard] queue error:', err); loadingQueue.value = false }
  )

  // Live user list — used for recipient search in Log Package tab
  unsubUsers = subscribeToAllUsers(
    (users) => { allUsers.value = users },
    (err) => console.error('[StaffDashboard] users error:', err)
  )

  // Live history — starts listening immediately so it's ready when tab opens
  unsubHistory = subscribeToRecentPackages(50,
    (pkgs) => { historyPackages.value = pkgs; loadingHistory.value = false },
    (err) => { console.error('[StaffDashboard] history error:', err); loadingHistory.value = false }
  )
})

onUnmounted(() => {
  unsubQueue?.()
  unsubHistory?.()
  unsubUsers?.()
})

// ── Queue filters ──────────────────────────────────────────────────────────
const searchQuery = ref('')
const activeCarrier = ref(null)
const carrierFilters = ['UPS', 'FedEx', 'USPS', 'Amazon', 'DHL']

const filteredPackages = computed(() => {
  let list = pendingPackages.value

  // Carrier pill filter
  if (activeCarrier.value) list = list.filter(p => p.carrier === activeCarrier.value)

  // Text search — matches any part of name, unit, email, carrier, or tracking
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => {
      // Look up the recipient's email from allUsers by cardId
      const recipientUser = allUsers.value.find(u => u.id === p.recipientCardId)
      return (
        p.recipientName?.toLowerCase().includes(q) ||
        p.recipientUnit?.toLowerCase().includes(q) ||
        p.carrier?.toLowerCase().includes(q) ||
        p.trackingNumber?.toLowerCase().includes(q) ||
        recipientUser?.email?.toLowerCase().includes(q)
      )
    })
  }
  return list
})

// ── Stats ──────────────────────────────────────────────────────────────────
const currentDate = computed(() =>
  new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
)

const todayCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return pendingPackages.value.filter(p => {
    if (!p.checkedInAt) return false
    const d = p.checkedInAt.toDate ? p.checkedInAt.toDate() : new Date(p.checkedInAt)
    return d >= today
  }).length
})

// ── Log package form ───────────────────────────────────────────────────────
const carriers = CARRIERS
const form = ref({ recipient: null, carrier: null, trackingNumber: '', notes: '' })
const recipientSearch = ref('')
const residentResults = ref([])

const canSubmit = computed(() => form.value.recipient && form.value.carrier)

// In-memory search — same approach as AdminPanel, filters the live allUsers array
// Matches any part of name, unit, or email using .includes()
function onRecipientInput() {
  const q = recipientSearch.value.toLowerCase().trim()
  if (!q) { residentResults.value = []; return }
  residentResults.value = allUsers.value
    .filter(u => u.role === 'resident' && (
      u.name?.toLowerCase().includes(q) ||
      u.unit?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ))
    .slice(0, 8)
}

function selectRecipient(resident) {
  form.value.recipient = resident
  recipientSearch.value = ''
  residentResults.value = []
}

async function submitPackage() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const pkg = await checkInPackage({
      recipientCardId: form.value.recipient.id,
      recipientName: form.value.recipient.name,
      recipientUnit: form.value.recipient.unit,
      carrier: form.value.carrier,
      trackingNumber: form.value.trackingNumber,
      notes: form.value.notes,
    }, 'staff')

    recentlyLogged.value.unshift(pkg)
    successMsg.value = `✓ Package logged for ${form.value.recipient.name}`
    setTimeout(() => { successMsg.value = '' }, 3000)
    form.value = { recipient: null, carrier: null, trackingNumber: '', notes: '' }
  } catch (err) {
    console.error('[StaffDashboard] log error:', err)
  } finally {
    submitting.value = false
  }
}

// ── Queue checkout ─────────────────────────────────────────────────────────
// No need to manually remove from list — the onSnapshot listener does it automatically
async function staffCheckout(pkg) {
  checkingOut.value = pkg.id
  try {
    await checkOutPackage(pkg.id, pkg.recipientCardId, 'staff')
  } catch (err) {
    console.error('[StaffDashboard] checkout error:', err)
  } finally {
    checkingOut.value = null
  }
}

// ── User menu ──────────────────────────────────────────────────────────────
const showUserMenu = ref(false)

const userInitials = computed(() =>
  auth.displayName?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
)

// ── Helpers ────────────────────────────────────────────────────────────────
function goToScan() { router.push({ name: 'scan' }) }
function goToAdmin() { showUserMenu.value = false; router.push({ name: 'admin' }) }
function signOut() { auth.logout(); router.push({ name: 'scan' }) }

function formatTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function packageAge(pkg) {
  if (!pkg.checkedInAt) return 0
  const d = pkg.checkedInAt.toDate ? pkg.checkedInAt.toDate() : new Date(pkg.checkedInAt)
  return Math.floor((Date.now() - d) / 86400000)
}

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}
</script>


<template>
  <div class="dashboard">

    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-mark">📬</span>
        <span class="logo-label">MAILROOM</span>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="nav-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-label">{{ tab.label }}</span>
          <span v-if="tab.id === 'queue' && pendingPackages.length" class="nav-badge">
            {{ pendingPackages.length }}
          </span>
        </button>
      </nav>

      <!-- User profile section -->
      <div class="sidebar-user" @click="showUserMenu = !showUserMenu">
        <div class="user-avatar">{{ userInitials }}</div>
        <div class="user-info">
          <div class="user-name">{{ auth.displayName || 'Staff' }}</div>
          <div class="user-role" :class="auth.role">{{ auth.role }}</div>
        </div>
        <span class="user-chevron" :class="{ open: showUserMenu }">›</span>
      </div>

      <!-- User dropdown menu -->
      <transition name="menu-slide">
        <div v-if="showUserMenu" class="user-menu">
          <button v-if="auth.isAdmin" class="user-menu-item admin" @click="goToAdmin">
            🔐 Admin Panel
          </button>
          <button class="user-menu-item" @click="goToScan">
            ← Back to Scanner
          </button>
          <div class="user-menu-divider" />
          <button class="user-menu-item signout" @click="signOut">
            Sign Out
          </button>
        </div>
      </transition>
    </aside>

    <!-- Main content -->
    <main class="content">

      <!-- ── TOP BAR ── -->
      <div class="topbar">
        <div class="topbar-title">
          <h1>{{ currentTab.label }}</h1>
          <span class="topbar-sub">{{ currentDate }}</span>
        </div>
        <div class="topbar-stats">
          <div class="stat">
            <span class="stat-val">{{ pendingPackages.length }}</span>
            <span class="stat-label">Pending</span>
          </div>
          <div class="stat-divider" />
          <div class="stat">
            <span class="stat-val">{{ todayCount }}</span>
            <span class="stat-label">Today</span>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: QUEUE                                     -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'queue'" class="tab-content">

        <div class="toolbar">
          <div class="search-wrap">
            <span class="search-icon">⌕</span>
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="Search by name, unit, carrier..."
              type="text"
            />
          </div>
          <div class="filter-pills">
            <button
              v-for="carrier in carrierFilters"
              :key="carrier"
              class="pill"
              :class="{ active: activeCarrier === carrier }"
              @click="activeCarrier = activeCarrier === carrier ? null : carrier"
            >{{ carrier }}</button>
          </div>
        </div>

        <div v-if="loadingQueue" class="loading-rows">
          <div v-for="n in 4" :key="n" class="skeleton-row" :style="{ animationDelay: `${n * 80}ms` }" />
        </div>

        <div v-else-if="filteredPackages.length === 0" class="empty-queue">
          <span>{{ pendingPackages.length === 0 ? '✓ Queue is clear' : 'No results match your filter' }}</span>
        </div>

        <div v-else class="queue-table">
          <div class="table-head">
            <span>Recipient</span>
            <span>Carrier</span>
            <span>Tracking</span>
            <span>Received</span>
            <span>Age</span>
            <span></span>
          </div>
          <transition-group name="row" tag="div" class="table-body">
            <div
              v-for="pkg in filteredPackages"
              :key="pkg.id"
              class="table-row"
              :class="{ 'row-old': packageAge(pkg) > 3 }"
            >
              <div class="cell-recipient">
                <div class="recipient-name">{{ pkg.recipientName }}</div>
                <div class="recipient-unit">Unit {{ pkg.recipientUnit }}</div>
              </div>
              <div class="cell-carrier">
                <span class="carrier-tag" :class="pkg.carrier?.toLowerCase()">
                  {{ pkg.carrier }}
                </span>
              </div>
              <div class="cell-tracking">
                <span class="tracking-num">{{ pkg.trackingNumber || '—' }}</span>
              </div>
              <div class="cell-date">{{ formatTime(pkg.checkedInAt) }}</div>
              <div class="cell-age" :class="{ 'age-warn': packageAge(pkg) > 3 }">
                {{ packageAge(pkg) }}d
              </div>
              <div class="cell-action">
                <button
                  class="action-btn checkout"
                  :disabled="checkingOut === pkg.id"
                  @click="staffCheckout(pkg)"
                >
                  <span v-if="checkingOut === pkg.id" class="micro-spinner" />
                  <span v-else>Hand Off</span>
                </button>
              </div>
            </div>
          </transition-group>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: LOG PACKAGE                               -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'log'" class="tab-content">

        <div class="log-layout">
          <!-- Form -->
          <div class="log-form-wrap">
            <div class="form-card">
              <h2 class="form-title">Log Incoming Package</h2>

              <!-- Step 1: Find recipient -->
              <div class="form-section">
                <label class="form-label">
                  <span class="label-num">01</span> Recipient
                </label>
                <div class="recipient-search">
                  <input
                    v-model="recipientSearch"
                    class="form-input"
                    placeholder="Search by name or unit..."
                    @input="onRecipientInput"
                  />
                  <div v-if="residentResults.length" class="resident-dropdown">
                    <button
                      v-for="r in residentResults"
                      :key="r.id"
                      class="resident-option"
                      @click="selectRecipient(r)"
                    >
                      <span class="ro-name">{{ r.name }}</span>
                      <span class="ro-unit">Unit {{ r.unit }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="form.recipient" class="selected-recipient">
                  <span class="sr-avatar">{{ initials(form.recipient.name) }}</span>
                  <div>
                    <div class="sr-name">{{ form.recipient.name }}</div>
                    <div class="sr-unit">Unit {{ form.recipient.unit }}</div>
                  </div>
                  <button class="sr-clear" @click="form.recipient = null; recipientSearch = ''">✕</button>
                </div>
              </div>

              <!-- Step 2: Carrier -->
              <div class="form-section">
                <label class="form-label">
                  <span class="label-num">02</span> Carrier
                </label>
                <div class="carrier-grid">
                  <button
                    v-for="c in carriers"
                    :key="c"
                    class="carrier-option"
                    :class="{ selected: form.carrier === c }"
                    @click="form.carrier = c"
                  >{{ c }}</button>
                </div>
              </div>

              <!-- Step 3: Tracking -->
              <div class="form-section">
                <label class="form-label">
                  <span class="label-num">03</span> Tracking Number
                  <span class="label-optional">(optional)</span>
                </label>
                <input
                  v-model="form.trackingNumber"
                  class="form-input"
                  placeholder="1Z999AA10123456784"
                />
              </div>

              <!-- Step 4: Notes -->
              <div class="form-section">
                <label class="form-label">
                  <span class="label-num">04</span> Notes
                  <span class="label-optional">(optional)</span>
                </label>
                <input
                  v-model="form.notes"
                  class="form-input"
                  placeholder="Fragile, oversized, refrigerated..."
                />
              </div>

              <button
                class="submit-btn"
                :disabled="!canSubmit || submitting"
                @click="submitPackage"
              >
                <span v-if="submitting" class="micro-spinner light" />
                <span v-else>Log Package →</span>
              </button>
            </div>
          </div>

          <!-- Recent logs (right panel) -->
          <div class="recent-logs">
            <h3 class="recent-title">Recently Logged</h3>
            <div v-if="recentlyLogged.length === 0" class="recent-empty">
              No packages logged this session
            </div>
            <div
              v-for="pkg in recentlyLogged"
              :key="pkg.id"
              class="recent-item"
            >
              <div class="recent-carrier">{{ pkg.carrier }}</div>
              <div class="recent-name">{{ pkg.recipientName }}</div>
              <div class="recent-unit">Unit {{ pkg.recipientUnit }}</div>
            </div>
          </div>
        </div>

        <!-- Success flash -->
        <transition name="toast">
          <div v-if="successMsg" class="success-toast">{{ successMsg }}</div>
        </transition>

      </section>

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: HISTORY                                   -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'history'" class="tab-content">
        <div v-if="loadingHistory" class="loading-rows">
          <div v-for="n in 5" :key="n" class="skeleton-row" :style="{ animationDelay: `${n * 60}ms` }" />
        </div>

        <div v-else class="history-table">
          <div class="table-head">
            <span>Recipient</span>
            <span>Carrier</span>
            <span>Checked In</span>
            <span>Picked Up</span>
            <span>Status</span>
          </div>
          <div class="table-body">
            <div
              v-for="pkg in historyPackages"
              :key="pkg.id"
              class="table-row"
            >
              <div class="cell-recipient">
                <div class="recipient-name">{{ pkg.recipientName }}</div>
                <div class="recipient-unit">Unit {{ pkg.recipientUnit }}</div>
              </div>
              <div class="cell-carrier">
                <span class="carrier-tag" :class="pkg.carrier?.toLowerCase()">{{ pkg.carrier }}</span>
              </div>
              <div class="cell-date">{{ formatTime(pkg.checkedInAt) }}</div>
              <div class="cell-date">{{ pkg.checkedOutAt ? formatTime(pkg.checkedOutAt) : '—' }}</div>
              <div class="cell-status">
                <span class="status-pill" :class="pkg.status">
                  {{ pkg.status === 'pending' ? 'Pending' : 'Picked Up' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  </div>
</template>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600&display=swap');

/* ── Layout ────────────────────────────────────────────────────────────── */
.dashboard {
  display: flex;
  min-height: 100vh;
  background: #0d1117;
  color: #c9d1d9;
  font-family: 'Outfit', sans-serif;
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #161b22;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid #30363d;
}
.logo-mark { font-size: 1.2rem; }
.logo-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: #58a6ff;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: none;
  background: none;
  color: #8b949e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}
.nav-item:hover { background: #21262d; color: #c9d1d9; }
.nav-item.active { background: #21262d; color: #e6edf3; }

.nav-icon { font-size: 0.9rem; width: 18px; text-align: center; }
.nav-label { flex: 1; }
.nav-badge {
  background: #58a6ff;
  color: #0d1117;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
}

.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid #30363d;
}
.scan-btn {
  width: 100%;
  background: none;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.scan-btn:hover { border-color: #58a6ff; color: #58a6ff; }

/* ── User profile ──────────────────────────────────────────────────────── */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  border-top: 1px solid #30363d;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.sidebar-user:hover { background: #21262d; }

.user-avatar {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: #1c2d3d;
  border: 1px solid #30363d;
  color: #58a6ff;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem; font-weight: 600;
  flex-shrink: 0;
}

.user-info { flex: 1; min-width: 0; }
.user-name {
  font-size: 0.82rem; font-weight: 500;
  color: #e6edf3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.user-role {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em;
  margin-top: 0.1rem;
}
.user-role.staff { color: #58a6ff; }
.user-role.admin { color: #f0b429; }

.user-chevron {
  font-size: 1.1rem; color: #8b949e;
  transition: transform 0.2s;
  line-height: 1;
}
.user-chevron.open { transform: rotate(90deg); }

/* ── User dropdown menu ────────────────────────────────────────────────── */
.user-menu {
  background: #0d1117;
  border-top: 1px solid #30363d;
  padding: 0.4rem 0;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1.25rem;
  background: none;
  border: none;
  color: #8b949e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.12s;
  text-align: left;
}
.user-menu-item:hover { background: #21262d; color: #c9d1d9; }
.user-menu-item.admin { color: #f0b429; }
.user-menu-item.admin:hover { background: rgba(240,180,41,0.08); color: #f0b429; }
.user-menu-item.signout:hover { background: rgba(248,81,73,0.1); color: #f85149; }

.user-menu-divider {
  height: 1px;
  background: #21262d;
  margin: 0.3rem 0;
}

.menu-slide-enter-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.menu-slide-leave-active { transition: all 0.15s ease; }
.menu-slide-enter-from, .menu-slide-leave-to { opacity: 0; transform: translateY(-4px); }

.admin-btn {
  width: 100%;
  background: rgba(240,180,41,0.08);
  border: 1px solid rgba(240,180,41,0.25);
  color: #f0b429;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  margin-bottom: 0.5rem;
}
.admin-btn:hover { background: rgba(240,180,41,0.15); border-color: #f0b429; }

/* ── Content ───────────────────────────────────────────────────────────── */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem 1rem;
  border-bottom: 1px solid #21262d;
}

.topbar-title h1 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #e6edf3;
  margin-bottom: 0.1rem;
}
.topbar-sub {
  font-size: 0.78rem;
  color: #8b949e;
  font-family: 'JetBrains Mono', monospace;
}

.topbar-stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.stat { text-align: right; }
.stat-val {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.4rem;
  font-weight: 600;
  color: #58a6ff;
  line-height: 1;
}
.stat-label {
  font-size: 0.72rem;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.stat-divider {
  width: 1px;
  height: 32px;
  background: #30363d;
}

/* ── Tab content ───────────────────────────────────────────────────────── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

/* ── Toolbar ───────────────────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #8b949e;
  font-size: 1.1rem;
}
.search-input {
  width: 100%;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0.55rem 0.75rem 0.55rem 2.25rem;
  color: #c9d1d9;
  font-family: 'Outfit', sans-serif;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: #58a6ff; }
.search-input::placeholder { color: #8b949e; }

.filter-pills {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.pill {
  background: none;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.15s;
}
.pill:hover { border-color: #58a6ff; color: #58a6ff; }
.pill.active { background: #58a6ff; border-color: #58a6ff; color: #0d1117; font-weight: 600; }

/* ── Table ─────────────────────────────────────────────────────────────── */
.queue-table, .history-table {
  border: 1px solid #21262d;
  border-radius: 10px;
  overflow: hidden;
}

.table-head {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr 1.5fr 0.5fr 1fr;
  padding: 0.6rem 1rem;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.history-table .table-head {
  grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1fr;
}

.table-body { display: flex; flex-direction: column; }

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr 1.5fr 0.5fr 1fr;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #21262d;
  align-items: center;
  transition: background 0.1s;
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #161b22; }
.table-row.row-old { border-left: 3px solid #f85149; }

.history-table .table-row {
  grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1fr;
}

.recipient-name { font-weight: 500; color: #e6edf3; font-size: 0.88rem; }
.recipient-unit { font-size: 0.75rem; color: #8b949e; margin-top: 0.1rem; }

.carrier-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: #21262d;
  color: #c9d1d9;
}
.carrier-tag.ups    { background: #2d1e0a; color: #f5a623; }
.carrier-tag.fedex  { background: #1a0e2e; color: #a78bfa; }
.carrier-tag.usps   { background: #0e1f2e; color: #58a6ff; }
.carrier-tag.amazon { background: #1e2a0e; color: #7ec8a0; }
.carrier-tag.dhl    { background: #2e1e0a; color: #fbbf24; }

.tracking-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: #8b949e;
}
.cell-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #8b949e;
}
.cell-age {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #8b949e;
}
.age-warn { color: #f85149; font-weight: 600; }

.action-btn {
  background: none;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.action-btn.checkout:hover { border-color: #3fb950; color: #3fb950; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.status-pill {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-weight: 500;
}
.status-pill.pending   { background: #2d1e0a; color: #f5a623; }
.status-pill.picked_up { background: #1e2a0e; color: #3fb950; }

/* ── Log form ──────────────────────────────────────────────────────────── */
.log-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.5rem;
  align-items: start;
}

.form-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 1.75rem;
}
.form-title {
  font-size: 1rem;
  font-weight: 600;
  color: #e6edf3;
  margin-bottom: 1.5rem;
}

.form-section { margin-bottom: 1.25rem; }

.form-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: #8b949e;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.label-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #58a6ff;
}
.label-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: #484f58; font-size: 0.78rem; }

.form-input {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  color: #c9d1d9;
  font-family: 'Outfit', sans-serif;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus { border-color: #58a6ff; }
.form-input::placeholder { color: #484f58; }

.recipient-search { position: relative; }
.resident-dropdown {
  position: absolute;
  top: 100%;
  left: 0; right: 0;
  background: #161b22;
  border: 1px solid #30363d;
  border-top: none;
  border-radius: 0 0 8px 8px;
  z-index: 10;
  overflow: hidden;
}
.resident-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: none;
  border: none;
  color: #c9d1d9;
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid #21262d;
  transition: background 0.1s;
}
.resident-option:last-child { border-bottom: none; }
.resident-option:hover { background: #21262d; }
.ro-unit { color: #8b949e; font-size: 0.78rem; }

.selected-recipient {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #0d1117;
  border: 1px solid #3fb950;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  margin-top: 0.5rem;
}
.sr-avatar {
  width: 32px; height: 32px;
  background: #1e2a0e;
  color: #3fb950;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.sr-name { font-weight: 500; font-size: 0.88rem; color: #e6edf3; }
.sr-unit { font-size: 0.75rem; color: #8b949e; }
.sr-clear {
  margin-left: auto;
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem;
  transition: color 0.15s;
}
.sr-clear:hover { color: #f85149; }

.carrier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.carrier-option {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 0.55rem;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.carrier-option:hover { border-color: #58a6ff; color: #58a6ff; }
.carrier-option.selected { background: #1c2d3d; border-color: #58a6ff; color: #58a6ff; font-weight: 600; }

.submit-btn {
  width: 100%;
  background: #238636;
  border: none;
  color: white;
  padding: 0.8rem;
  border-radius: 8px;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.submit-btn:hover:not(:disabled) { background: #2ea043; }
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Recent logs ───────────────────────────────────────────────────────── */
.recent-logs {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 1.25rem;
}
.recent-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}
.recent-empty { font-size: 0.82rem; color: #484f58; }

.recent-item {
  padding: 0.6rem 0;
  border-bottom: 1px solid #21262d;
}
.recent-item:last-child { border-bottom: none; }
.recent-carrier {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #58a6ff;
  margin-bottom: 0.1rem;
}
.recent-name { font-size: 0.85rem; color: #e6edf3; font-weight: 500; }
.recent-unit { font-size: 0.75rem; color: #8b949e; }

/* ── Loading skeletons ─────────────────────────────────────────────────── */
.loading-rows { display: flex; flex-direction: column; gap: 0.5rem; }
.skeleton-row {
  height: 52px;
  background: linear-gradient(90deg, #161b22 25%, #21262d 50%, #161b22 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.2s infinite both;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-queue {
  text-align: center;
  padding: 4rem;
  color: #8b949e;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.88rem;
}

/* ── Spinners ──────────────────────────────────────────────────────────── */
.micro-spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
.micro-spinner.light { border-top-color: white; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Toast ─────────────────────────────────────────────────────────────── */
.success-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: #238636;
  color: white;
  padding: 0.9rem 1.75rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.88rem;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.toast-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(16px); }
.toast-leave-to     { opacity: 0; }

/* ── Row transition ────────────────────────────────────────────────────── */
.row-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.row-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>