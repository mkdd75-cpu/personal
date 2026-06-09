<!-- src/views/AdminPanel.vue -->
<!-- Admin-only view. Manage users/cards, assign roles, view audit log.     -->
<!-- Tabs: Users, Register Card, Audit Log                                  -->

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  registerUser,
  updateUser,
  subscribeToAllUsers,
  subscribeToAllPendingPackages,
  subscribeToAllTransactions,
} from '@/services/firestoreService'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/models'
import { useCardReader } from '@/composables/useCardReader'

const router = useRouter()
const auth = useAuthStore()

if (!auth.isLoggedIn || !auth.isAdmin) {
  router.replace({ name: 'scan' })
}

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'users',    label: 'Users',         icon: '👤' },
  { id: 'register', label: 'Register Card', icon: '💳' },
  { id: 'audit',    label: 'Audit Log',     icon: '📋' },
]
const activeTab = ref('users')

// ── Users tab ──────────────────────────────────────────────────────────────
const allUsers = ref([])
const loadingUsers = ref(true)
const userSearch = ref('')
const roleFilter = ref('all')

const filteredUsers = computed(() => {
  let list = allUsers.value
  if (roleFilter.value !== 'all') list = list.filter(u => u.role === roleFilter.value)
  if (userSearch.value) {
    const q = userSearch.value.toLowerCase()
    list = list.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.unit?.toLowerCase().includes(q)
    )
  }
  return list
})

const totalUsers = computed(() => allUsers.value.length)

// ── Stats ──────────────────────────────────────────────────────────────────
const pendingCount = ref(0)

// ── Register card tab ──────────────────────────────────────────────────────
const regForm = ref({ cardId: '', name: '', unit: '', email: '', role: ROLES.RESIDENT })
const registering = ref(false)
const registerMsg = ref('')
const registerMsgType = ref('success')
const manualCardEntry = ref(false)

const canRegister = computed(() =>
  regForm.value.cardId &&
  regForm.value.name &&
  regForm.value.unit &&
  regForm.value.email &&
  regForm.value.role
)

// Capture swipe on register tab in swipe mode (not manual entry mode)
const captureEnabled = computed(() =>
  activeTab.value === 'register' && !manualCardEntry.value && !regForm.value.cardId
)

const { isListening } = useCardReader({
  enabled: captureEnabled,
  onSwipe: ({ cardId }) => {
    if (activeTab.value === 'register' && !regForm.value.cardId) {
      regForm.value.cardId = cardId
    }
  },
})

async function registerCard() {
  if (!canRegister.value || registering.value) return
  registering.value = true

  try {
    // Check if card already registered
    const existing = allUsers.value.find(u => u.id === regForm.value.cardId)
    if (existing) {
      registerMsg.value = `⚠ Card already registered to ${existing.name}`
      registerMsgType.value = 'error'
      return
    }

    await registerUser({
      cardId: regForm.value.cardId,
      name: regForm.value.name,
      unit: regForm.value.unit,
      email: regForm.value.email,
      role: regForm.value.role,
    })

    allUsers.value.unshift({ id: regForm.value.cardId, ...regForm.value, active: true })

    registerMsg.value = `✓ ${regForm.value.name} registered successfully`
    registerMsgType.value = 'success'

    regForm.value = { cardId: '', name: '', unit: '', email: '', role: ROLES.RESIDENT }
    manualCardEntry.value = false
    setTimeout(() => { registerMsg.value = '' }, 4000)

  } catch (err) {
    registerMsg.value = `Error: ${err.message}`
    registerMsgType.value = 'error'
  } finally {
    registering.value = false
  }
}

// ── Edit user ──────────────────────────────────────────────────────────────
const editingUser = ref(null)
const editForm = ref({})
const saving = ref(false)

function openEdit(user) {
  editingUser.value = user
  editForm.value = { name: user.name, email: user.email, unit: user.unit }
}

async function saveEdit() {
  saving.value = true
  try {
    await updateUser(editingUser.value.id, editForm.value)
    Object.assign(editingUser.value, editForm.value)
    editingUser.value = null
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function updateRole(user, role) {
  await updateUser(user.id, { role })
  user.role = role
}

async function toggleActive(user) {
  const newVal = !user.active
  await updateUser(user.id, { active: newVal })
  user.active = newVal
}

// ── Audit log tab ──────────────────────────────────────────────────────────
const transactions = ref([])
const loadingAudit = ref(true)

// ── Listeners ──────────────────────────────────────────────────────────────
let unsubUsers = null
let unsubPending = null
let unsubTransactions = null

onMounted(() => {
  // Live user list
  unsubUsers = subscribeToAllUsers(
    (users) => { allUsers.value = users; loadingUsers.value = false },
    (err) => { console.error('[AdminPanel] users error:', err); loadingUsers.value = false }
  )

  // Live pending count for header stat
  unsubPending = subscribeToAllPendingPackages(
    (pkgs) => { pendingCount.value = pkgs.length },
    (err) => console.error('[AdminPanel] pending error:', err)
  )

  // Live audit log
  unsubTransactions = subscribeToAllTransactions(100,
    (txs) => { transactions.value = txs; loadingAudit.value = false },
    (err) => { console.error('[AdminPanel] audit error:', err); loadingAudit.value = false }
  )
})

onUnmounted(() => {
  unsubUsers?.()
  unsubPending?.()
  unsubTransactions?.()
})

// ── Helpers ────────────────────────────────────────────────────────────────
function goBack() { router.push({ name: 'scan' }) }
function goToStaff() { router.push({ name: 'staff-dashboard' }) }
function signOut() { auth.logout(); router.push({ name: 'scan' }) }

function resolvePerformedBy(performedBy) {
  if (!performedBy) return '—'
  const user = allUsers.value.find(u => u.id === performedBy)
  if (user) return user.name
  if (performedBy === 'staff') return 'Staff (legacy)'
  return truncateCard(performedBy)
}

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

function truncateCard(id) {
  if (!id) return '—'
  return id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="admin-panel">

    <!-- Header -->
    <header class="admin-header">
      <div class="header-left">
        <button class="back-link" @click="goBack">← Scanner</button>
        <div class="divider-v" />
        <button class="back-link" @click="goToStaff">Staff Dashboard</button>
        <div class="divider-v" />
        <span class="admin-badge">ADMIN</span>
        <h1 class="header-title">System Administration</h1>
      </div>
      <div class="header-right">
        <div class="live-dot" />
        <span class="live-label">{{ totalUsers }} users · {{ pendingCount }} pending packages</span>
        <button class="signout-btn" @click="signOut">Sign Out</button>
      </div>
    </header>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <!-- Content -->
    <div class="panel-body">

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: USERS                                     -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'users'" class="tab-section">

        <div class="section-toolbar">
          <div class="search-box">
            <span class="search-ico">⌕</span>
            <input v-model="userSearch" class="search-inp" placeholder="Search users..." />
          </div>
          <div class="role-filters">
            <button
              v-for="r in ['all', 'resident', 'staff', 'admin']"
              :key="r"
              class="role-pill"
              :class="{ active: roleFilter === r }"
              @click="roleFilter = r"
            >{{ r }}</button>
          </div>
        </div>

        <div v-if="loadingUsers" class="skeletons">
          <div v-for="n in 6" :key="n" class="skel" :style="{ animationDelay: `${n * 60}ms` }" />
        </div>

        <div v-else class="users-grid">
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="user-card"
            :class="{ inactive: !user.active }"
          >
            <div class="uc-top">
              <div class="uc-avatar" :class="user.role">
                {{ initials(user.name) }}
              </div>
              <div class="uc-info">
                <div class="uc-name">{{ user.name }}</div>
                <div class="uc-email">{{ user.email }}</div>
              </div>
              <div class="uc-role-badge" :class="user.role">{{ user.role }}</div>
            </div>

            <div class="uc-meta">
              <span class="uc-unit">Unit {{ user.unit }}</span>
              <span class="uc-card">Card: <code>{{ truncateCard(user.cardId) }}</code></span>
            </div>

            <div class="uc-actions">
              <select
                class="role-select"
                :value="user.role"
                @change="updateRole(user, $event.target.value)"
              >
                <option value="resident">Resident</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button
                class="toggle-btn"
                :class="{ deactivate: user.active }"
                @click="toggleActive(user)"
              >
                {{ user.active ? 'Deactivate' : 'Reactivate' }}
              </button>
              <button class="edit-btn" @click="openEdit(user)">Edit</button>
            </div>
          </div>
        </div>

        <div v-if="!loadingUsers && filteredUsers.length === 0" class="empty-state">
          No users match your search.
        </div>
      </section>

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: REGISTER CARD                             -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'register'" class="tab-section">
        <div class="register-layout">

          <!-- Left: form -->
          <div class="register-form-wrap">
            <div class="form-block">
              <div class="form-block-title">
                <span class="fbt-num">①</span> Swipe or Enter Card ID
                <button class="manual-toggle-btn" @click="manualCardEntry = !manualCardEntry">
                  {{ manualCardEntry ? '💳 Use Swipe Instead' : '⌨️ Enter Manually' }}
                </button>
              </div>

              <!-- Swipe mode -->
              <div v-if="!manualCardEntry" class="swipe-zone" :class="{ 'has-card': regForm.cardId }">
                <div v-if="!regForm.cardId" class="swipe-prompt">
                  <div class="swipe-card-icon">💳</div>
                  <p>Swipe the card to capture its ID</p>
                  <p class="swipe-hint">Reader is {{ isListening ? 'active' : 'inactive' }}</p>
                </div>
                <div v-else class="swipe-success">
                  <span class="swipe-check">✓</span>
                  <div>
                    <div class="swipe-captured">Card captured</div>
                    <code class="swipe-id">{{ regForm.cardId }}</code>
                  </div>
                  <button class="swipe-reset" @click="regForm.cardId = ''">✕</button>
                </div>
              </div>

              <!-- Manual entry mode -->
              <div v-else class="manual-card-entry">
                <label class="field-label">Card ID</label>
                <div class="manual-card-row">
                  <input
                    v-model="regForm.cardId"
                    class="field-input"
                    placeholder="Enter or paste card ID..."
                    @keydown.enter="$event.target.blur()"
                  />
                  <button v-if="regForm.cardId" class="swipe-reset inline" @click="regForm.cardId = ''">✕</button>
                </div>
                <p class="manual-card-hint">
                  Type the card ID directly, or swipe the card while this input is focused.
                </p>
              </div>
            </div>

            <div class="form-block">
              <div class="form-block-title">
                <span class="fbt-num">②</span> User Details
              </div>

              <div class="field-row">
                <div class="field">
                  <label class="field-label">Full Name</label>
                  <input v-model="regForm.name" class="field-input" placeholder="Jane Smith" />
                </div>
                <div class="field">
                  <label class="field-label">Unit / Room</label>
                  <input v-model="regForm.unit" class="field-input" placeholder="204A" />
                </div>
              </div>

              <div class="field">
                <label class="field-label">Email Address</label>
                <input v-model="regForm.email" class="field-input" type="email" placeholder="jane@example.com" />
              </div>

              <div class="field">
                <label class="field-label">Role</label>
                <div class="role-selector">
                  <button
                    v-for="r in ['resident', 'staff', 'admin']"
                    :key="r"
                    class="role-opt"
                    :class="{ selected: regForm.role === r }"
                    @click="regForm.role = r"
                  >{{ r }}</button>
                </div>
              </div>
            </div>

            <button
              class="register-btn"
              :disabled="!canRegister || registering"
              @click="registerCard"
            >
              <span v-if="registering" class="btn-spin" />
              <span v-else>Register Card & Create User →</span>
            </button>

            <transition name="msg">
              <div v-if="registerMsg" class="register-msg" :class="registerMsgType">
                {{ registerMsg }}
              </div>
            </transition>
          </div>

          <!-- Right: instructions -->
          <div class="register-help">
            <h3 class="help-title">How to register</h3>
            <ol class="help-steps">
              <li>Make sure the card reader is plugged in and the cursor is NOT focused on any text input — click somewhere neutral on the page first.</li>
              <li>Swipe the card. The ID will be captured automatically.</li>
              <li>Fill in the user's name, unit, email, and assign a role.</li>
              <li>Click Register. The user can immediately swipe in at the scanner.</li>
            </ol>
            <div class="help-note">
              <strong>Roles:</strong><br/>
              <span class="role-desc resident">Resident</span> — can view and pick up their own packages.<br/>
              <span class="role-desc staff">Staff</span> — can log packages and manage the queue.<br/>
              <span class="role-desc admin">Admin</span> — full access including this panel.
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════ -->
      <!-- TAB: AUDIT LOG                                 -->
      <!-- ══════════════════════════════════════════════ -->
      <section v-if="activeTab === 'audit'" class="tab-section">

        <div v-if="loadingAudit" class="skeletons">
          <div v-for="n in 8" :key="n" class="skel" :style="{ animationDelay: `${n * 40}ms` }" />
        </div>

        <div v-else class="audit-table">
          <div class="audit-head">
            <span>Timestamp</span>
            <span>Type</span>
            <span>Recipient Card</span>
            <span>Package ID</span>
            <span>Performed By</span>
          </div>
          <div class="audit-body">
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="audit-row"
              :class="tx.type"
            >
              <span class="audit-time">{{ formatTimestamp(tx.timestamp) }}</span>
              <span class="audit-type" :class="tx.type">
                {{ tx.type === 'checkin' ? '↓ Check In' : '↑ Pick Up' }}
              </span>
              <code class="audit-card">{{ truncateCard(tx.cardId) }}</code>
              <code class="audit-pkg">{{ tx.packageId?.slice(0, 10) }}…</code>
              <span class="audit-by">{{ resolvePerformedBy(tx.performedBy) }}</span>
            </div>
            <div v-if="transactions.length === 0" class="audit-empty">
              No transactions recorded yet.
            </div>
          </div>
        </div>
      </section>

    </div>

    <!-- Edit User Modal -->
    <transition name="modal">
      <div v-if="editingUser" class="modal-overlay" @click.self="editingUser = null">
        <div class="modal">
          <div class="modal-header">
            <h2>Edit User</h2>
            <button class="modal-close" @click="editingUser = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label class="field-label">Full Name</label>
              <input v-model="editForm.name" class="field-input" />
            </div>
            <div class="field">
              <label class="field-label">Email</label>
              <input v-model="editForm.email" class="field-input" type="email" />
            </div>
            <div class="field">
              <label class="field-label">Unit</label>
              <input v-model="editForm.unit" class="field-input" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-cancel" @click="editingUser = null">Cancel</button>
            <button class="modal-save" :disabled="saving" @click="saveEdit">
              <span v-if="saving" class="btn-spin light" />
              <span v-else>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Epilogue:wght@300;400;500;600&display=swap');

/* ── Base ──────────────────────────────────────────────────────────────── */
.admin-panel {
  min-height: 100vh;
  background: #fafaf8;
  color: #1c1c1c;
  font-family: 'Epilogue', sans-serif;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #1c1c1c;
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-family: 'Epilogue', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  transition: color 0.15s;
}
.back-link:hover { color: white; }

.divider-v {
  width: 1px;
  height: 18px;
  background: rgba(255,255,255,0.15);
}

.admin-badge {
  font-family: monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  background: #dc2626;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
}

.header-title {
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #22c55e;
  animation: livepulse 2s ease-in-out infinite;
}
@keyframes livepulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.live-label {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.45);
  font-family: monospace;
}

.signout-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.4);
  padding: 0.35rem 0.85rem;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 1rem;
}
.signout-btn:hover { border-color: #f85149; color: #f85149; }

/* ── Tab bar ───────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  border-bottom: 2px solid #e5e5e0;
  background: white;
  padding: 0 2rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover { color: #1c1c1c; }
.tab-btn.active { color: #1c1c1c; border-bottom-color: #1c1c1c; }
.tab-icon { font-size: 0.9rem; }

/* ── Panel body ────────────────────────────────────────────────────────── */
.panel-body {
  padding: 2rem;
  max-width: 1200px;
}

/* ── Section toolbar ───────────────────────────────────────────────────── */
.section-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}
.search-ico {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #aaa;
  font-size: 1rem;
}
.search-inp {
  width: 100%;
  background: white;
  border: 1.5px solid #e5e5e0;
  border-radius: 8px;
  padding: 0.55rem 0.75rem 0.55rem 2.1rem;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s;
}
.search-inp:focus { border-color: #1c1c1c; }

.role-filters { display: flex; gap: 0.4rem; }
.role-pill {
  background: none;
  border: 1.5px solid #e5e5e0;
  color: #888;
  padding: 0.35rem 0.9rem;
  border-radius: 20px;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.15s;
}
.role-pill:hover { border-color: #1c1c1c; color: #1c1c1c; }
.role-pill.active { background: #1c1c1c; border-color: #1c1c1c; color: white; }

/* ── Users grid ────────────────────────────────────────────────────────── */
.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.user-card {
  background: white;
  border: 1.5px solid #e5e5e0;
  border-radius: 12px;
  padding: 1.25rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.user-card:hover { border-color: #ccc; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.user-card.inactive { opacity: 0.5; }

.uc-top {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.uc-avatar {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.uc-avatar.resident { background: #fef3c7; color: #92400e; }
.uc-avatar.staff    { background: #dbeafe; color: #1e40af; }
.uc-avatar.admin    { background: #fee2e2; color: #991b1b; }

.uc-info { flex: 1; min-width: 0; }
.uc-name { font-weight: 600; font-size: 0.92rem; color: #1c1c1c; }
.uc-email { font-size: 0.75rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.uc-role-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  flex-shrink: 0;
}
.uc-role-badge.resident { background: #fef3c7; color: #92400e; }
.uc-role-badge.staff    { background: #dbeafe; color: #1e40af; }
.uc-role-badge.admin    { background: #fee2e2; color: #991b1b; }

.uc-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 0.9rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f0f0ec;
}
.uc-card code {
  font-family: monospace;
  background: #f5f5f0;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 0.72rem;
}

.uc-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.role-select {
  background: #fafaf8;
  border: 1.5px solid #e5e5e0;
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.78rem;
  color: #1c1c1c;
  cursor: pointer;
  outline: none;
}

.toggle-btn, .edit-btn {
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid #e5e5e0;
  background: none;
  color: #888;
}
.toggle-btn.deactivate:hover { border-color: #dc2626; color: #dc2626; }
.toggle-btn:not(.deactivate):hover { border-color: #22c55e; color: #22c55e; }
.edit-btn:hover { border-color: #1c1c1c; color: #1c1c1c; }

/* ── Register form ─────────────────────────────────────────────────────── */
.register-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  align-items: start;
}

.form-block {
  background: white;
  border: 1.5px solid #e5e5e0;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.form-block-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: 'Fraunces', serif;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
}
.fbt-num {
  font-size: 1.1rem;
  color: #888;
}

/* Swipe zone */
.swipe-zone {
  border: 2px dashed #d1d1cc;
  border-radius: 10px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s;
}
.swipe-zone.has-card {
  border-style: solid;
  border-color: #22c55e;
  background: #f0fdf4;
}

.swipe-prompt { color: #aaa; }
.swipe-card-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.swipe-prompt p { font-size: 0.88rem; }
.swipe-hint { font-size: 0.75rem; color: #ccc; margin-top: 0.25rem; }

.swipe-success {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
}
.swipe-check {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #22c55e;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}
.swipe-captured { font-size: 0.78rem; color: #888; margin-bottom: 0.2rem; }
.swipe-id {
  font-family: monospace;
  font-size: 0.85rem;
  color: #1c1c1c;
  background: #f0f0ec;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.swipe-reset {
  margin-left: auto;
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 1rem;
}
.swipe-reset:hover { color: #dc2626; }

.manual-toggle-btn {
  margin-left: auto;
  background: none;
  border: 1px solid #e5e5e0;
  border-radius: 6px;
  padding: 0.25rem 0.65rem;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.72rem;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.manual-toggle-btn:hover { border-color: #1c1c1c; color: #1c1c1c; }

.manual-card-entry { display: flex; flex-direction: column; gap: 0.4rem; }
.manual-card-row { display: flex; gap: 0.5rem; align-items: center; }
.manual-card-row .field-input { flex: 1; }
.swipe-reset.inline {
  position: static;
  background: #f5f5f0;
  border: 1px solid #e5e5e0;
  border-radius: 6px;
  color: #aaa;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
  flex-shrink: 0;
}
.swipe-reset.inline:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
.manual-card-hint { font-size: 0.72rem; color: #aaa; margin-top: 0.1rem; }

/* Fields */
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field { margin-bottom: 0.9rem; }
.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}
.field-input {
  width: 100%;
  background: #fafaf8;
  border: 1.5px solid #e5e5e0;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.88rem;
  color: #1c1c1c;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: #1c1c1c; background: white; }

.role-selector { display: flex; gap: 0.5rem; }
.role-opt {
  flex: 1;
  padding: 0.55rem;
  background: #fafaf8;
  border: 1.5px solid #e5e5e0;
  border-radius: 8px;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.15s;
  color: #888;
}
.role-opt:hover { border-color: #1c1c1c; color: #1c1c1c; }
.role-opt.selected { background: #1c1c1c; border-color: #1c1c1c; color: white; }

.register-btn {
  width: 100%;
  background: #1c1c1c;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.9rem;
  font-family: 'Fraunces', serif;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.register-btn:hover:not(:disabled) { background: #333; }
.register-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.register-msg {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
}
.register-msg.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.register-msg.error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

/* Help panel */
.register-help {
  background: white;
  border: 1.5px solid #e5e5e0;
  border-radius: 12px;
  padding: 1.5rem;
}
.help-title {
  font-family: 'Fraunces', serif;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.help-steps {
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: #555;
  line-height: 1.5;
  margin-bottom: 1.25rem;
}
.help-note {
  background: #fafaf8;
  border-radius: 8px;
  padding: 0.9rem;
  font-size: 0.78rem;
  color: #666;
  line-height: 1.7;
}
.role-desc {
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.72rem;
}
.role-desc.resident { background: #fef3c7; color: #92400e; }
.role-desc.staff    { background: #dbeafe; color: #1e40af; }
.role-desc.admin    { background: #fee2e2; color: #991b1b; }

/* ── Audit log ─────────────────────────────────────────────────────────── */
.audit-table {
  border: 1.5px solid #e5e5e0;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}

.audit-head {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1.5fr;
  padding: 0.6rem 1rem;
  background: #fafaf8;
  border-bottom: 1.5px solid #e5e5e0;
  font-size: 0.7rem;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.audit-body { display: flex; flex-direction: column; }

.audit-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1.5fr;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid #f0f0ec;
  align-items: center;
  font-size: 0.82rem;
  transition: background 0.1s;
}
.audit-row:last-child { border-bottom: none; }
.audit-row:hover { background: #fafaf8; }
.audit-row.checkin { border-left: 3px solid #3b82f6; }
.audit-row.checkout { border-left: 3px solid #22c55e; }

.audit-time { color: #888; font-size: 0.75rem; font-family: monospace; }
.audit-type { font-weight: 600; font-size: 0.78rem; }
.audit-type.checkin  { color: #3b82f6; }
.audit-type.checkout { color: #22c55e; }
.audit-card, .audit-pkg, .audit-by {
  font-family: monospace;
  font-size: 0.75rem;
  color: #555;
  background: #f5f5f0;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  width: fit-content;
}
.audit-empty {
  padding: 3rem;
  text-align: center;
  color: #aaa;
  font-size: 0.85rem;
}

/* ── Skeletons ─────────────────────────────────────────────────────────── */
.skeletons { display: flex; flex-direction: column; gap: 0.75rem; }
.skel {
  height: 48px;
  background: linear-gradient(90deg, #f0f0ec 25%, #e8e8e4 50%, #f0f0ec 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #aaa;
  font-size: 0.88rem;
}

/* ── Modal ─────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}

.modal {
  background: white;
  border-radius: 16px;
  width: 420px;
  max-width: 90vw;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0ec;
}
.modal-header h2 {
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  font-weight: 600;
}
.modal-close {
  background: none;
  border: none;
  color: #aaa;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
}
.modal-close:hover { color: #1c1c1c; }

.modal-body { padding: 1.5rem; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f0f0ec;
  background: #fafaf8;
}

.modal-cancel {
  background: none;
  border: 1.5px solid #e5e5e0;
  color: #888;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
}
.modal-save {
  background: #1c1c1c;
  color: white;
  border: none;
  padding: 0.55rem 1.5rem;
  border-radius: 8px;
  font-family: 'Epilogue', sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: background 0.15s;
}
.modal-save:hover:not(:disabled) { background: #333; }
.modal-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Spinners ──────────────────────────────────────────────────────────── */
.btn-spin {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
.btn-spin.light { border-top-color: white; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Transitions ───────────────────────────────────────────────────────── */
.modal-enter-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from   { opacity: 0; transform: scale(0.95); }
.modal-leave-to     { opacity: 0; transform: scale(0.97); }

.msg-enter-active { transition: all 0.3s ease; }
.msg-leave-active { transition: all 0.2s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-4px); }
</style>