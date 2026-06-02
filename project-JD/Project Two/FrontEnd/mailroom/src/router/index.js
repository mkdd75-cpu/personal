// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import ScanView from '@/views/ScanView.vue'

const routes = [
  {
    path: '/',
    name: 'scan',
    component: ScanView,
  },
  {
    path: '/resident/:cardId',
    name: 'resident',
    component: () => import('@/views/ResidentView.vue'),
  },
  {
    path: '/staff',
    name: 'staff-dashboard',
    component: () => import('@/views/StaffDashboard.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminPanel.vue'),
  },
  {
    path: '/test',
    name: 'test',
    component: () => import('@/components/CardReaderTest.vue'),
  },
  // Fallback — always return to scan screen
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
