<script setup>
import { useUserStore } from '@/stores/counter'
import PatientView from '@/views/PatientView.vue'
import DoctorView from '@/views/DoctorView.vue'
import PreceptorView from '@/views/PreceptorView.vue'
const userStore = useUserStore()
</script>

<template>
  <PatientView   v-if="userStore.user?.role === 'patient'" />
  <DoctorView    v-else-if="userStore.user?.role === 'doctor'" />
  <PreceptorView v-else-if="userStore.user?.role === 'preceptor'" />
  <div v-else class="no-role">
    <p>Could not determine your role. Please sign out and sign in again.</p>
  </div>
</template>

<style scoped>
.no-role { padding: 2rem; color: var(--gray-600); text-align: center; }
</style>