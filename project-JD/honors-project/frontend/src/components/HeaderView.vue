<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/counter'
import { useRouter } from 'vue-router'
import SignInModal from '@/components/SignInModal.vue'

const userStore = useUserStore()
const router = useRouter()
const showSignIn = ref(false)

function logout() {
  userStore.logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <header class="header">
    <div class="header-brand">
      <img src="/Nkwapa Watch (3).png" alt="Akomapa Health" class="header-logo" />
      <span class="header-name">Nkwapa Health</span>
    </div>

    <nav class="header-nav">
      <a href="https://www.akomapa.org/" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
        <span class="material-symbols-outlined">open_in_new</span>
        Akomapa Clinic
      </a>

      <!-- Show Sign In button if not logged in (e.g. on public pages) -->
      <button v-if="!userStore.user" class="btn btn-primary btn-sm" @click="showSignIn = true">
        Sign In
      </button>

      <button v-if="userStore.user" class="btn btn-outline btn-sm" @click="logout">
        <span class="material-symbols-outlined">logout</span>
        Logout
      </button>
    </nav>
  </header>

  <SignInModal v-model="showSignIn" />
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-h);
  background: var(--white);
  border-bottom: 2px solid var(--green);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  box-shadow: var(--shadow-sm);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 2px solid var(--green-200);
  object-fit: cover;
}

.header-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--green);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.material-symbols-outlined { font-size: 16px !important; }

@media (max-width: 480px) {
  .header-name { display: none; }
}
</style>