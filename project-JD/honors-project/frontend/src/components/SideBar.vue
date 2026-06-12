<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/counter'
import { computed } from 'vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const menuItems = computed(() => [
  { icon: 'home',           label: 'Home',         to: () => router.push({ name: 'main' }) },
  { icon: 'account_circle', label: 'Profile',      to: () => router.push({ name: 'profile' }) },
  { icon: 'search',         label: 'Search',       to: () => router.push({ name: 'search' }) },
  { icon: 'calendar_month', label: 'Appointments', to: () => router.push({ name: 'appointments' }) },
  { icon: 'forum',          label: 'Messages',     to: () => router.push(`/mymessages/${userStore.user?._id}`) },
])

const isActive = (label) => {
  const name = route.name || ''
  const path = route.path || ''
  if (label === 'Home' && name === 'main') return true
  if (label === 'Profile' && name === 'profile') return true
  if (label === 'Search' && name === 'search') return true
  if (label === 'Appointments' && name === 'appointments') return true
  if (label === 'Messages' && path.includes('mymessages')) return true
  return false
}
</script>

<template>
  <aside class="sidebar">
    <button
      v-for="item in menuItems"
      :key="item.label"
      class="nav-item"
      :class="{ active: isActive(item.label) }"
      @click="item.to"
    >
      <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
    </button>
  </aside>
</template>

<style scoped>
.sidebar { width: var(--sidebar-w); background: var(--white); border-right: 1px solid var(--gray-200); display: flex; flex-direction: column; padding: 1rem 0.75rem; gap: 4px; flex-shrink: 0; }
.nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.65rem 0.9rem; border: none; border-radius: var(--radius-md); background: transparent; color: var(--gray-600); font-size: 0.88rem; font-weight: 500; cursor: pointer; transition: all 0.18s; text-align: left; font-family: var(--font); }
.nav-item:hover { background: var(--green-50); color: var(--green); }
.nav-item.active { background: var(--green-100); color: var(--green-800); font-weight: 600; }
.nav-icon { font-size: 20px !important; flex-shrink: 0; }
.nav-label { font-size: 0.88rem; }
@media (max-width: 768px) {
  .sidebar { width: 100%; flex-direction: row; border-right: none; border-bottom: 1px solid var(--gray-200); padding: 0.5rem; overflow-x: auto; }
  .nav-item { flex-direction: column; gap: 2px; padding: 0.5rem 0.7rem; min-width: 62px; }
  .nav-label { font-size: 0.68rem; }
}
</style>