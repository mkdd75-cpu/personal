import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'

import App from './App.vue'
import router from './router'
import { useUserStore } from '@/stores/counter'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// Restore the session (re-fetch the full user from the token) BEFORE mounting,
// so a page refresh keeps the user signed in with all their data intact and
// route guards see the correct auth state immediately.
const userStore = useUserStore(pinia)

userStore.restoreSession().finally(() => {
  app.use(router)

  // Dev helper: Ctrl+B toggles layout debug outlines
  document.body.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'b') {
      document.body.classList.toggle('border')
    }
  })

  app.mount('#app')
})