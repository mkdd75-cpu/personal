<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const userStore = useUserStore()
const route = useRoute()

const partnerId = computed(() => route.params.user_id)
const userId = computed(() => userStore.user?._id)

const messages = ref([])
const newMessage = ref('')
const partner = ref(null)
const loadError = ref('')
const sendError = ref('')
const loadingMessages = ref(false)
const sending = ref(false)
const scrollAnchor = ref(null)

let pollInterval = null

function startPolling() {
  stopPolling()
  pollInterval = setInterval(loadMessages, 5000)
}
function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

async function scrollToBottom() {
  await nextTick()
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' })
}

async function loadPartnerInfo() {
  try {
    const res = await userStore.apiFetch(apiUrl(`/users/${partnerId.value}`))
    if (res.ok) partner.value = await res.json()
  } catch (err) { console.error(err) }
}

function mapMessages(raw) {
  return (raw || []).map(m => ({
    senderId: m.sender?._id ?? m.sender,
    isMine: (m.sender?._id ?? m.sender) === userId.value,
    senderName: m.sender?.firstname ?? '',
    text: m.content,
    timestamp: m.timestamp,
  }))
}

async function loadMessages() {
  try {
    const res = await userStore.apiFetch(apiUrl(`/message/${userId.value}/${partnerId.value}`))
    if (!res.ok) throw new Error('Could not load messages')
    const data = await res.json()
    const prevCount = messages.value.length
    messages.value = mapMessages(data.messages)
    loadError.value = ''
    if (messages.value.length !== prevCount) scrollToBottom()
  } catch (err) {
    console.error(err)
    loadError.value = 'Could not load messages. Check your connection.'
  }
}

async function sendMessage() {
  const text = newMessage.value.trim()
  if (!text || sending.value) return

  newMessage.value = ''
  sendError.value = ''
  sending.value = true

  try {
    const res = await userStore.apiFetch(
      apiUrl(`/directmessages/${userId.value}/${partnerId.value}`),
      { method: 'POST', body: JSON.stringify({ content: text }) }
    )
    if (!res.ok) throw new Error('Failed to send message')
    const updated = await res.json()
    messages.value = mapMessages(updated.messages)
    scrollToBottom()
  } catch (err) {
    console.error(err)
    sendError.value = 'Message failed to send. Tap to retry.'
    newMessage.value = text
  } finally {
    sending.value = false
  }
}

// Group messages with date separators
const groupedMessages = computed(() => {
  const groups = []
  let lastDate = null
  for (const msg of messages.value) {
    const d = new Date(msg.timestamp)
    const dayKey = d.toDateString()
    if (dayKey !== lastDate) {
      groups.push({ type: 'separator', label: formatDay(d), key: 'sep-' + dayKey })
      lastDate = dayKey
    }
    groups.push({ type: 'message', ...msg, key: msg.timestamp + '-' + Math.random() })
  }
  return groups
})

function formatDay(d) {
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const partnerInitials = computed(() => {
  if (!partner.value) return '?'
  return (partner.value.firstname?.[0] || '') + (partner.value.lastname?.[0] || '')
})

async function load() {
  // Prevent users from opening a chat with themselves
  if (partnerId.value === userId.value) {
    loadError.value = 'You cannot message yourself.'
    loadingMessages.value = false
    return
  }
  loadingMessages.value = true
  await Promise.all([loadPartnerInfo(), loadMessages()])
  loadingMessages.value = false
  startPolling()
  scrollToBottom()
}

onMounted(load)
onUnmounted(stopPolling)
watch(() => route.params.user_id, () => { stopPolling(); messages.value = []; load() })
</script>

<template>
  <div class="chat-shell">
    <!-- Header -->
    <header class="chat-top">
      <div class="partner-avatar">{{ partnerInitials.toUpperCase() }}</div>
      <div class="partner-meta">
        <span class="partner-name" v-if="partner">{{ partner.firstname }} {{ partner.lastname }}</span>
        <span class="partner-name" v-else>Loading…</span>
        <span class="partner-role" v-if="partner?.role">{{ partner.role }}<template v-if="partner.specialization"> · {{ partner.specialization }}</template></span>
      </div>
    </header>

    <!-- Messages -->
    <div class="chat-stream">
      <div v-if="loadingMessages" class="stream-status">Loading conversation…</div>
      <div v-else-if="loadError" class="stream-status error">{{ loadError }}</div>
      <div v-else-if="messages.length === 0" class="stream-empty">
        <div class="empty-icon">
          <span class="material-symbols-outlined">chat</span>
        </div>
        <p>No messages yet</p>
        <span>Send a message to start the conversation</span>
      </div>

      <template v-for="item in groupedMessages" :key="item.key">
        <div v-if="item.type === 'separator'" class="date-sep">
          <span>{{ item.label }}</span>
        </div>
        <div v-else class="msg-row" :class="{ mine: item.isMine }">
          <div class="bubble">
            <p class="bubble-text">{{ item.text }}</p>
            <span class="bubble-time">{{ formatTime(item.timestamp) }}</span>
          </div>
        </div>
      </template>

      <div ref="scrollAnchor"></div>
    </div>

    <!-- Error bar -->
    <div v-if="sendError" class="send-error" @click="sendMessage">{{ sendError }}</div>

    <!-- Composer -->
    <div class="composer">
      <input
        v-model="newMessage"
        @keyup.enter="sendMessage"
        placeholder="Type a message…"
        maxlength="2000"
        :disabled="sending"
      />
      <button class="send-btn" @click="sendMessage" :disabled="!newMessage.trim() || sending">
        <span class="material-symbols-outlined">send</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--gray-50);
}

/* Header */
.chat-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.9rem 1.4rem;
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}
.partner-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--green);
  color: var(--white);
  font-weight: 700; font-size: 0.95rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.partner-meta { display: flex; flex-direction: column; }
.partner-name { font-size: 1rem; font-weight: 600; color: var(--gray-900); }
.partner-role { font-size: 0.8rem; color: var(--green); text-transform: capitalize; }

/* Stream */
.chat-stream {
  flex: 1;
  overflow-y: auto;
  padding: 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stream-status { text-align: center; color: var(--gray-500); padding: 2rem; font-size: 0.9rem; }
.stream-status.error { color: var(--error); }

.stream-empty {
  margin: auto;
  text-align: center;
  color: var(--gray-400);
}
.empty-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: var(--green-50);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 0.8rem;
}
.empty-icon .material-symbols-outlined { font-size: 30px; color: var(--green-300); }
.stream-empty p { font-size: 1rem; font-weight: 600; color: var(--gray-600); margin-bottom: 2px; }
.stream-empty span { font-size: 0.85rem; }

/* Date separator */
.date-sep {
  text-align: center;
  margin: 0.8rem 0 0.5rem;
}
.date-sep span {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--gray-500);
  background: var(--gray-200);
  padding: 3px 12px;
  border-radius: 12px;
}

/* Message rows */
.msg-row { display: flex; margin-bottom: 2px; }
.msg-row.mine { justify-content: flex-end; }

.bubble {
  max-width: 72%;
  padding: 0.6rem 0.85rem 0.4rem;
  border-radius: 16px;
  position: relative;
  box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}
.msg-row:not(.mine) .bubble {
  background: var(--white);
  border-bottom-left-radius: 4px;
  color: var(--gray-800);
}
.msg-row.mine .bubble {
  background: var(--green);
  border-bottom-right-radius: 4px;
  color: var(--white);
}

.bubble-text { font-size: 0.92rem; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; }
.bubble-time { font-size: 0.66rem; opacity: 0.7; display: block; text-align: right; margin-top: 2px; }

/* Error bar */
.send-error {
  background: var(--error-bg);
  color: var(--error);
  font-size: 0.82rem;
  padding: 0.5rem 1.4rem;
  cursor: pointer;
  border-top: 1px solid #fcc;
}

/* Composer */
.composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.8rem 1.4rem;
  background: var(--white);
  border-top: 1px solid var(--gray-200);
  flex-shrink: 0;
}
.composer input {
  flex: 1;
  border: 1.5px solid var(--gray-200);
  border-radius: 22px;
  padding: 0.65rem 1.1rem;
  font-size: 0.95rem;
  background: var(--gray-50);
}
.composer input:focus { background: var(--white); border-color: var(--green); }

.send-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--green);
  color: var(--white);
  border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, transform 0.1s;
}
.send-btn:hover:not(:disabled) { background: var(--green-700); }
.send-btn:active:not(:disabled) { transform: scale(0.92); }
.send-btn:disabled { background: var(--gray-300); cursor: not-allowed; }
.send-btn .material-symbols-outlined { font-size: 20px; }

@media (max-width: 768px) {
  .bubble { max-width: 82%; }
}
</style>