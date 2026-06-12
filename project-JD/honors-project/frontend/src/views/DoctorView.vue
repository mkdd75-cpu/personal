<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/counter'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()
const user = computed(() => userStore.user || {})

const fullName = computed(() =>
  [user.value.firstname, user.value.middlename, user.value.lastname].filter(Boolean).join(' ')
)

const averageRating = computed(() => {
  const r = user.value.ratings || []
  if (!r.length) return null
  return (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1)
})
</script>

<template>
  <div class="dashboard">
    <div class="profile-banner">
      <div class="avatar">{{ user.firstname?.charAt(0) }}{{ user.lastname?.charAt(0) }}</div>
      <div>
        <h2 class="banner-name">{{ fullName }}</h2>
        <span class="badge badge-green">Doctor</span>
      </div>
      <button class="btn btn-outline btn-sm ml-auto" @click="router.push({ name: 'profile' })">
        <span class="material-symbols-outlined">edit</span> Edit Profile
      </button>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-header"><h3>Personal Information</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Full Name</span><span class="field-value">{{ fullName || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Email</span><span class="field-value">{{ user.email || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Phone</span><span class="field-value">{{ user.phone || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Gender</span><span class="field-value">{{ user.gender || '—' }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Professional Information</h3></div>
        <div class="card-body">
          <div class="field-row"><span class="field-label">Cohort</span><span class="field-value">{{ user.cohort || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Specialization</span><span class="field-value">{{ user.specialization || '—' }}</span></div>
          <div class="field-row"><span class="field-label">Patients</span><span class="field-value">{{ user.patients?.length || 0 }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Ratings &amp; Reviews</h3></div>
        <div class="card-body">
          <div v-if="averageRating" class="rating-display">
            <span class="rating-number">{{ averageRating }}</span>
            <span class="rating-label">/ 5.0 average</span>
          </div>
          <p v-else class="text-muted" style="font-size:.9rem">No ratings yet</p>

          <div v-if="(user.reviews || []).length" class="reviews-list mt-2">
            <div v-for="(review, i) in user.reviews" :key="i" class="review-item">
              <strong>{{ review.reviewer }}</strong>: {{ review.comment }}
              <span class="badge badge-green ml-1">{{ review.rating }}/5</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Quick Actions</h3></div>
        <div class="card-body actions-col">
          <button class="action-btn" @click="router.push({ name: 'search' })">
            <span class="material-symbols-outlined">search</span>Find a Patient
          </button>
          <button class="action-btn" @click="router.push(`/mymessages/${user._id}`)">
            <span class="material-symbols-outlined">forum</span>My Messages
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { padding: 1.5rem; }
.profile-banner { display: flex; align-items: center; gap: 1rem; padding: 1.2rem 1.5rem; background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--green-100); margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); }
.avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--green); color: var(--white); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner-name { font-size: 1.15rem; color: var(--gray-900); margin-bottom: 3px; }
.ml-auto { margin-left: auto; }
.ml-1 { margin-left: 0.25rem; }
.dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.rating-display { display: flex; align-items: baseline; gap: 6px; }
.rating-number { font-size: 2rem; font-weight: 700; color: var(--green); }
.rating-label { font-size: 0.85rem; color: var(--gray-500); }
.reviews-list { display: flex; flex-direction: column; gap: 0.5rem; }
.review-item { font-size: 0.88rem; color: var(--gray-700); padding: 0.5rem; background: var(--gray-50); border-radius: var(--radius-sm); }
.actions-col { display: flex; flex-direction: column; gap: 0.6rem; }
.action-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.75rem 1rem; border: 1.5px solid var(--green-200); border-radius: var(--radius-md); background: var(--green-50); color: var(--green-800); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all .18s; font-family: var(--font); }
.action-btn:hover { background: var(--green); color: var(--white); border-color: var(--green); }
.action-btn .material-symbols-outlined { font-size: 20px !important; }
</style>