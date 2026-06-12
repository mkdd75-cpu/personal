<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()
const recentChats = ref([])
const appointments = ref([])
const loadingChats = ref(true)
const loadingAppts = ref(true)

const userId = computed(() => userStore.user?._id)

async function loadChats() {
  if (!userId.value) return
  try {
    const res = await userStore.apiFetch(apiUrl(`/mymessages/${userId.value}`))
    if (!res.ok) return
    let chats = await res.json()
    chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    recentChats.value = chats.slice(0, 4).flatMap(chat => {
      const partners = (chat.participants || []).filter(p => (typeof p === 'object' ? p._id : p) !== userId.value)
      return partners.map(p => ({
        partnerId: typeof p === 'object' ? p._id : p,
        name: typeof p === 'object' ? `${p.firstname} ${p.lastname}` : 'Unknown',
        role: typeof p === 'object' ? p.role : '',
      }))
    }).slice(0, 4)
  } catch (err) { console.error(err) } finally { loadingChats.value = false }
}

async function loadAppointments() {
  if (!userId.value) return
  try {
    const res = await userStore.apiFetch(apiUrl(`/appointments/${userId.value}`))
    if (!res.ok) return
    const all = await res.json()
    const now = new Date()
    appointments.value = all
      .filter(a => ['pending', 'confirmed'].includes(a.status) && new Date(a.scheduledFor) >= new Date(now.toDateString()))
      .slice(0, 3)
  } catch (err) { console.error(err) } finally { loadingAppts.value = false }
}

function otherParty(appt) {
  return appt.requester?._id === userId.value ? appt.recipient : appt.requester
}

function fmtShort(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

let refreshTimer = null

function refreshAll() { loadChats(); loadAppointments() }

onMounted(() => {
  refreshAll()
  // Auto-refresh the right pane every 15 seconds
  refreshTimer = setInterval(refreshAll, 15000)
})

onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<template>
  <aside class="right-panel">
    <section class="rp-section">
      <h3 class="rp-heading">Recent Chats</h3>
      <div v-if="loadingChats" class="rp-empty">Loading…</div>
      <div v-else-if="recentChats.length === 0" class="rp-empty">No recent chats</div>
      <button v-for="chat in recentChats" :key="chat.partnerId" class="chat-item" @click="router.push(`/message/${chat.partnerId}`)">
        <div class="chat-avatar">{{ chat.name.charAt(0).toUpperCase() }}</div>
        <div class="chat-info">
          <span class="chat-name">{{ chat.name }}</span>
          <span class="chat-role">{{ chat.role }}</span>
        </div>
      </button>
    </section>

    <section class="rp-section">
      <div class="rp-head-row">
        <h3 class="rp-heading">Upcoming</h3>
        <button class="see-all" @click="router.push({ name: 'appointments' })">See all</button>
      </div>
      <div v-if="loadingAppts" class="rp-empty">Loading…</div>
      <div v-else-if="appointments.length === 0" class="rp-empty">No upcoming appointments</div>
      <button v-for="appt in appointments" :key="appt._id" class="appt-item" @click="router.push({ name: 'appointments' })">
        <div class="appt-date">{{ fmtShort(appt.scheduledFor) }}</div>
        <div class="appt-info">
          <span class="appt-with">{{ otherParty(appt)?.firstname }} {{ otherParty(appt)?.lastname }}</span>
          <span class="appt-reason">{{ appt.reason }}</span>
        </div>
        <span class="appt-status" :class="`s-${appt.status}`"></span>
      </button>
    </section>
  </aside>
</template>

<style scoped>
.right-panel { width: var(--right-w); background: var(--white); border-left: 1px solid var(--gray-200); display: flex; flex-direction: column; padding: 1rem 0.85rem; gap: 1.5rem; overflow-y: auto; flex-shrink: 0; }
.rp-heading { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--gray-500); margin-bottom: 0.6rem; }
.rp-head-row { display: flex; align-items: center; justify-content: space-between; }
.see-all { background: none; border: none; color: var(--green); font-size: 0.72rem; font-weight: 600; cursor: pointer; }
.rp-empty { font-size: 0.85rem; color: var(--gray-400); padding: 0.4rem 0; }

.chat-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.55rem 0.6rem; border: none; border-radius: var(--radius-md); background: transparent; cursor: pointer; transition: background 0.18s; text-align: left; font-family: var(--font); margin-bottom: 2px; }
.chat-item:hover { background: var(--green-50); }
.chat-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--green-100); color: var(--green-800); font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.chat-info { display: flex; flex-direction: column; min-width: 0; }
.chat-name { font-size: 0.87rem; font-weight: 600; color: var(--gray-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-role { font-size: 0.75rem; color: var(--gray-500); text-transform: capitalize; }

.appt-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.55rem 0.6rem; border: none; border-radius: var(--radius-md); background: transparent; cursor: pointer; transition: background 0.18s; text-align: left; font-family: var(--font); margin-bottom: 2px; }
.appt-item:hover { background: var(--green-50); }
.appt-date { font-size: 0.72rem; font-weight: 700; color: var(--green-800); background: var(--green-100); border-radius: 8px; padding: 4px 7px; text-align: center; line-height: 1.2; flex-shrink: 0; min-width: 44px; }
.appt-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.appt-with { font-size: 0.84rem; font-weight: 600; color: var(--gray-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.appt-reason { font-size: 0.74rem; color: var(--gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.appt-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.s-pending { background: #e0a317; }
.s-confirmed { background: var(--green); }

@media (max-width: 768px) { .right-panel { display: none; } }
</style>