import { ref } from 'vue'
import { defineStore } from 'pinia'
import router from '@/router'
import { apiUrl } from '@/config/api.js'

export const useUserStore = defineStore('User', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  // Only the token is persisted in localStorage. The full user object lives in
  // memory and is re-fetched from the server on every page load.
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(null)
  // True while we are restoring the session on a fresh page load. The app should
  // wait for this to finish before deciding the user is "not logged in".
  const restoring = ref(false)

  // ── Token helpers ──────────────────────────────────────────────────────────
  function decodeToken(t) {
    try {
      return JSON.parse(atob(t.split('.')[1]))
    } catch {
      return null
    }
  }

  function isTokenValid(t = token.value) {
    if (!t) return false
    const payload = decodeToken(t)
    if (!payload) return false
    // exp is in seconds; treat a missing exp as valid (no expiry)
    if (payload.exp && payload.exp * 1000 < Date.now()) return false
    return true
  }

  function clearSession() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  // ── Session restore ────────────────────────────────────────────────────────
  /**
   * Called once when the app boots (see main.js). If we have a valid token,
   * fetch the full user profile so refreshes keep the user signed in with all
   * their data intact. If the token is missing/expired/invalid, clear it.
   */
  async function restoreSession() {
    if (!token.value) return

    // Immediately drop expired/corrupt tokens
    if (!isTokenValid()) {
      clearSession()
      return
    }

    // Minimal hydration first (role + id) so route guards work instantly
    const payload = decodeToken(token.value)
    if (payload) {
      user.value = { _id: payload.id, role: payload.role }
    }

    // Then fetch the full, current profile from the server
    restoring.value = true
    try {
      const res = await fetch(apiUrl('/me'), {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (res.ok) {
        user.value = await res.json()
      } else if (res.status === 401) {
        // Server rejected the token (expired/invalid) — sign out cleanly
        clearSession()
      }
    } catch (err) {
      // Network error — keep the minimal user so the app still works offline-ish.
      console.error('Session restore failed:', err)
    } finally {
      restoring.value = false
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  const isAuthenticated = () => isTokenValid()
  const role = () => user.value?.role || null

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Call this after a successful sign-in or register response.
   * Stores only the token; the full user object lives in memory.
   */
  function setAuth(newToken, userData) {
    token.value = newToken
    user.value = userData
    localStorage.setItem('token', newToken)
  }

  /**
   * Refresh the in-memory user from the server (e.g. after editing the profile).
   */
  async function refreshUser() {
    if (!token.value) return
    try {
      const res = await fetch(apiUrl('/me'), {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (res.ok) user.value = await res.json()
    } catch (err) {
      console.error('Refresh user failed:', err)
    }
  }

  /**
   * Attach the token to every outgoing fetch automatically.
   * Use this instead of raw fetch() throughout the app.
   */
  async function apiFetch(path, options = {}) {
    const { headers = {}, ...rest } = options
    const res = await fetch(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        ...headers,
      },
    })

    // Auto-logout on an expired/invalid token so the user isn't stuck
    if (res.status === 401 && token.value) {
      clearSession()
      router.push({ name: 'home', query: { modal: 'signin' } })
    }

    return res
  }

  function logout() {
    clearSession()
    router.push({ name: 'home' })
  }

  return {
    token,
    user,
    restoring,
    isAuthenticated,
    role,
    setAuth,
    refreshUser,
    restoreSession,
    apiFetch,
    logout,
  }
})