<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/counter'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const router = useRouter()
const chats = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const userId = userStore.user?._id
  if (!userId) return

  try {
    const res = await userStore.apiFetch(apiUrl(`/mymessages/${userId}`))
    if (!res.ok) throw new Error('Failed to load messages')
    const data = await res.json()

    // Populate partner display info from already-populated participants
    chats.value = data
      .map(chat => {
        const partner = (chat.participants || []).find(p => {
          const id = typeof p === 'object' ? p._id : p
          return id !== userId
        })
        if (!partner) return null
        const id = typeof partner === 'object' ? partner._id : partner
        const name = typeof partner === 'object'
          ? `${partner.firstname} ${partner.lastname}`
          : 'Unknown'
        const role = typeof partner === 'object' ? partner.role : ''
        const lastMsg = (chat.messages || []).at(-1)
        return { chatId: chat._id, partnerId: id, name, role, lastMsg, updatedAt: chat.updatedAt }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

function formatTime(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diff = now - date
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="msg-list">
    <h2 class="msg-title">Chats</h2>

    <div v-if="loading" class="status">Loading…</div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
    <div v-else-if="chats.length === 0" class="status">
      No conversations yet. Use Search to find someone to message.
    </div>

    <div v-else class="chats">
      <button
        v-for="chat in chats"
        :key="chat.chatId"
        class="chat-row"
        @click="router.push(`/message/${chat.partnerId}`)"
      >
        <div class="chat-avatar">{{ chat.name.charAt(0).toUpperCase() }}</div>
        <div class="chat-body">
          <div class="chat-top">
            <span class="chat-name">{{ chat.name }}</span>
            <span class="chat-time">{{ formatTime(chat.updatedAt) }}</span>
          </div>
          <div class="chat-bottom">
            <span class="chat-role">{{ chat.role }}</span>
            <span v-if="chat.lastMsg" class="chat-preview">{{ chat.lastMsg.content }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.msg-list { padding: 1.5rem; }
.msg-title { margin-bottom: 1rem; }
.status { padding: 1rem; color: var(--gray-500); font-size: 0.9rem; }
.chats { display: flex; flex-direction: column; gap: 4px; }

.chat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0.8rem 1rem;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.18s;
  text-align: left;
  font-family: var(--font);
}
.chat-row:hover { border-color: var(--green); box-shadow: var(--shadow-sm); }

.chat-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--green-100); color: var(--green-800); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.chat-body { flex: 1; min-width: 0; }
.chat-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
.chat-name { font-size: 0.92rem; font-weight: 600; color: var(--gray-900); }
.chat-time { font-size: 0.75rem; color: var(--gray-400); flex-shrink: 0; }
.chat-bottom { display: flex; align-items: center; gap: 8px; }
.chat-role { font-size: 0.75rem; color: var(--green); font-weight: 600; text-transform: capitalize; background: var(--green-50); padding: 1px 7px; border-radius: 10px; }
.chat-preview { font-size: 0.82rem; color: var(--gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
</style>