<script setup>
import { ref, computed } from 'vue'
import { useCardReader } from '@/composables/useCardReader'

const lastSwipe = ref(null)
const errorMsg = ref(null)

const { isListening, isProcessing } = useCardReader({
  onSwipe: async (parsed) => {
    lastSwipe.value = parsed
    errorMsg.value = null
  },
  onError: (msg) => {
    errorMsg.value = msg
  },
})

const statusText = computed(() => {
  if (isProcessing.value) return 'Processing...'
  if (isListening.value) return 'Listening for card swipe'
  return 'Reader inactive'
})

const statusClass = computed(() => ({
  processing: isProcessing.value,
  listening: isListening.value && !isProcessing.value,
}))

function clearResult() {
  lastSwipe.value = null
  errorMsg.value = null
}
</script>



<template>
  <div class="reader-test">
    <div class="status-bar" :class="statusClass">
      <span class="dot" />
      {{ statusText }}
    </div>

    <div class="swipe-prompt" v-if="!lastSwipe">
      <div class="icon">💳</div>
      <p>Swipe a card to test the reader</p>
    </div>

    <div class="result" v-if="lastSwipe">
      <h3>✅ Card Detected</h3>
      <table>
        <tr>
          <td>Card ID</td>
          <td><code>{{ lastSwipe.cardId }}</code></td>
        </tr>
        <tr>
          <td>Track</td>
          <td>{{ lastSwipe.track ? `Track ${lastSwipe.track}` : 'Custom / Unknown' }}</td>
        </tr>
        <tr>
          <td>Raw Data</td>
          <td><code>{{ lastSwipe.raw }}</code></td>
        </tr>
      </table>
      <button @click="clearResult">Clear</button>
    </div>

    <div class="error" v-if="errorMsg">
      ⚠️ {{ errorMsg }}
      <button @click="errorMsg = null">Dismiss</button>
    </div>
  </div>
</template>

<style scoped>
.reader-test {
  max-width: 480px;
  margin: 2rem auto;
  font-family: monospace;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: #f0f0f0;
  font-size: 0.85rem;
}
.status-bar.listening { background: #e6f4ea; color: #2d7a3a; }
.status-bar.processing { background: #fff3cd; color: #856404; }

.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.swipe-prompt {
  text-align: center;
  padding: 3rem;
  border: 2px dashed #ccc;
  border-radius: 12px;
  color: #888;
}
.swipe-prompt .icon { font-size: 3rem; margin-bottom: 0.5rem; }

.result {
  padding: 1.5rem;
  border: 1px solid #28a745;
  border-radius: 8px;
  background: #f0fff4;
}
.result h3 { margin: 0 0 1rem; }
.result table { width: 100%; border-collapse: collapse; }
.result td { padding: 0.4rem 0.5rem; border-bottom: 1px solid #ddd; }
.result td:first-child { color: #666; width: 30%; }
.result code { background: #e8e8e8; padding: 2px 6px; border-radius: 4px; }
.result button {
  margin-top: 1rem;
  padding: 0.4rem 1rem;
  border: 1px solid #28a745;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.error {
  padding: 1rem;
  background: #fff0f0;
  border: 1px solid #dc3545;
  border-radius: 8px;
  color: #721c24;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
