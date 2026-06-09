// src/stores/auth.js
// Central auth store — holds the currently logged-in user for the whole session.
// ScanView sets this on every successful swipe or manual login.
// All views read from here instead of relying on history.state.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null) // full user object from Firestore

  const isLoggedIn  = computed(() => !!user.value)
  const isAdmin     = computed(() => user.value?.role === 'admin')
  const isStaff     = computed(() => user.value?.role === 'staff' || user.value?.role === 'admin')
  const isResident  = computed(() => user.value?.role === 'resident')
  const role        = computed(() => user.value?.role ?? null)
  const displayName = computed(() => user.value?.name ?? '')
  const unit        = computed(() => user.value?.unit ?? '')
  const cardId      = computed(() => user.value?.id ?? '')

  function login(userData) {
    user.value = userData
  }

  function logout() {
    user.value = null
  }

  return { user, isLoggedIn, isAdmin, isStaff, isResident, role, displayName, unit, cardId, login, logout }
})