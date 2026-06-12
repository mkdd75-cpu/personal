<script setup>
import { ref, watch } from 'vue'
import { useUserStore } from '@/stores/counter'
import { apiUrl } from '@/config/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  target: { type: Object, default: null }, // the user being booked with
})
const emit = defineEmits(['update:modelValue', 'booked'])

const userStore = useUserStore()
const reason = ref('')
const visitType = ref('screening')
const scheduledFor = ref('')
const saving = ref(false)
const error = ref('')
const success = ref('')

const visitTypes = ['screening', 'acute', 'follow-up', 'counseling']

watch(() => props.modelValue, (open) => {
  if (open) { reason.value = ''; visitType.value = 'screening'; scheduledFor.value = ''; error.value = ''; success.value = '' }
})

function close() { emit('update:modelValue', false) }

async function book() {
  error.value = ''
  if (!reason.value.trim() || !scheduledFor.value) {
    error.value = 'Please provide a reason and date/time.'
    return
  }
  saving.value = true
  try {
    const res = await userStore.apiFetch(apiUrl('/appointments'), {
      method: 'POST',
      body: JSON.stringify({
        recipientId: props.target._id,
        reason: reason.value.trim(),
        visitType: visitType.value,
        scheduledFor: scheduledFor.value,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to book appointment')
    }
    success.value = 'Appointment booked successfully!'
    emit('booked')
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
            <h3>Book Appointment</h3>
            <button class="close-btn" @click="close"><span class="material-symbols-outlined">close</span></button>
          </div>

          <div class="modal-body">
            <div v-if="target" class="target-info">
              <div class="avatar">{{ (target.firstname?.[0] || '') + (target.lastname?.[0] || '') }}</div>
              <div>
                <strong>{{ target.firstname }} {{ target.lastname }}</strong>
                <span class="role-tag">{{ target.role }}<template v-if="target.specialization"> · {{ target.specialization }}</template></span>
              </div>
            </div>

            <div v-if="error" class="alert alert-error">{{ error }}</div>
            <div v-if="success" class="alert alert-success">{{ success }}</div>

            <label class="field">
              Reason for visit *
              <input v-model="reason" type="text" placeholder="e.g. Blood pressure check" />
            </label>

            <label class="field">
              Visit type
              <select v-model="visitType">
                <option v-for="t in visitTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
              </select>
            </label>

            <label class="field">
              Date &amp; time *
              <input v-model="scheduledFor" type="datetime-local" />
            </label>

            <button class="btn btn-primary btn-full mt-1" @click="book" :disabled="saving">
              {{ saving ? 'Booking…' : 'Confirm Booking' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.45); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: var(--white); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.25); width: 100%; max-width: 440px; overflow: hidden; border-top: 4px solid var(--green); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--gray-200); }
.modal-header h3 { color: var(--green); }
.close-btn { background: none; border: none; cursor: pointer; color: var(--gray-500); padding: 4px; border-radius: 6px; display: flex; }
.close-btn:hover { background: var(--gray-100); }
.modal-body { padding: 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; }
.target-info { display: flex; align-items: center; gap: 12px; padding: 0.8rem; background: var(--green-50); border-radius: var(--radius-md); }
.avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--green); color: var(--white); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; text-transform: uppercase; }
.target-info strong { display: block; color: var(--gray-900); }
.role-tag { font-size: 0.8rem; color: var(--green); text-transform: capitalize; }
.field { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); }
.mt-1 { margin-top: 0.4rem; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.22s, opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { transform: translateY(-16px) scale(0.97); opacity: 0; }
</style>