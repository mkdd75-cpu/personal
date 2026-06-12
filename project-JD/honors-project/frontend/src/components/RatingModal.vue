<script setup>
import { ref, watch } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  target: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'rated'])

const userStore = useUserStore()
const rating = ref(0)
const hover = ref(0)
const comment = ref('')
const saving = ref(false)
const error = ref('')
const success = ref('')

watch(() => props.modelValue, (open) => {
  if (open) { rating.value = 0; hover.value = 0; comment.value = ''; error.value = ''; success.value = '' }
})

function close() { emit('update:modelValue', false) }

async function submit() {
  error.value = ''
  if (!rating.value) { error.value = 'Please select a star rating.'; return }
  saving.value = true
  try {
    const res = await userStore.apiFetch(apiUrl(`/ratings/${props.target._id}`), {
      method: 'POST',
      body: JSON.stringify({ rating: rating.value, comment: comment.value.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to submit rating')
    }
    success.value = 'Thank you for your feedback!'
    emit('rated')
    setTimeout(close, 1200)
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="backdrop" @click.self="close">
        <div class="modal">
          <div class="modal-header">
            <h3>Leave a Review</h3>
            <button class="close-btn" @click="close"><span class="material-symbols-outlined">close</span></button>
          </div>

          <div class="modal-body">
            <p v-if="target" class="rate-target">
              How was your experience with
              <strong>{{ target.firstname }} {{ target.lastname }}</strong>?
            </p>

            <div v-if="error" class="alert alert-error">{{ error }}</div>
            <div v-if="success" class="alert alert-success">{{ success }}</div>

            <!-- Stars -->
            <div class="stars">
              <button
                v-for="n in 5"
                :key="n"
                class="star"
                :class="{ filled: n <= (hover || rating) }"
                @click="rating = n"
                @mouseenter="hover = n"
                @mouseleave="hover = 0"
              >
                <span class="material-symbols-outlined">star</span>
              </button>
            </div>
            <p class="rating-label">{{ ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][hover || rating] || 'Tap to rate' }}</p>

            <label class="field">
              Comment (optional)
              <textarea v-model="comment" rows="3" placeholder="Share details of your experience…"></textarea>
            </label>

            <button class="btn btn-primary btn-full" @click="submit" :disabled="saving">
              {{ saving ? 'Submitting…' : 'Submit Review' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.45); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: var(--white); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.25); width: 100%; max-width: 420px; overflow: hidden; border-top: 4px solid var(--green); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--gray-200); }
.modal-header h3 { color: var(--green); }
.close-btn { background: none; border: none; cursor: pointer; color: var(--gray-500); padding: 4px; border-radius: 6px; display: flex; }
.close-btn:hover { background: var(--gray-100); }
.modal-body { padding: 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; }
.rate-target { font-size: 0.92rem; color: var(--gray-700); text-align: center; }
.stars { display: flex; justify-content: center; gap: 6px; }
.star { background: none; border: none; cursor: pointer; padding: 2px; color: var(--gray-300); transition: color 0.15s, transform 0.1s; }
.star:hover { transform: scale(1.15); }
.star.filled { color: #f5b301; }
.star .material-symbols-outlined { font-size: 36px; font-variation-settings: 'FILL' 1; }
.rating-label { text-align: center; font-size: 0.85rem; color: var(--gray-500); font-weight: 600; margin-top: -0.4rem; }
.field { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); }
textarea { resize: vertical; font-family: var(--font); }
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.22s, opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { transform: translateY(-16px) scale(0.97); opacity: 0; }
</style>