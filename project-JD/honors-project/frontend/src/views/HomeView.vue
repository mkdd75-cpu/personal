<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import FooterView from '@/components/FooterView.vue'
import SignInModal from '@/components/SignInModal.vue'

const route = useRoute()
// Auto-open if redirected here with ?modal=signin (e.g. from protected route guard)
const showSignIn = ref(route.query.modal === 'signin')
onMounted(() => {
  if (route.query.modal === 'signin') showSignIn.value = true
})
</script>

<template>
  <div class="home">
    <!-- Nav -->
    <nav class="home-nav">
      <div class="home-nav-brand">
        <img src="/Nkwapa Watch (3).png" alt="Nkwapa Health" class="brand-logo" />
        <span>Nkwapa Health</span>
      </div>
      <div class="home-nav-actions">
        <button class="btn btn-outline btn-sm" @click="showSignIn = true">Sign In</button>
        <RouterLink to="/joinus" class="btn btn-primary btn-sm">Join Us</RouterLink>
      </div>
    </nav>

    <!-- Hero -->
    <main class="home-hero">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="material-symbols-outlined" style="font-size:14px">verified</span>
          Trusted by Akomapa Clinic
        </div>
        <h1>Healthcare, connected.<br>Records, secured.</h1>
        <p class="hero-sub">
          Nkwapa Health bridges patients, doctors, and preceptors with
          secure messaging, digital medical records, and streamlined
          clinical workflows — all in one platform.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" @click="showSignIn = true">Sign In</button>
          <RouterLink to="/joinus" class="btn btn-outline btn-lg">Create Account</RouterLink>
        </div>
      </div>

      <div class="hero-card">
        <img src="/Nkwapa Watch (3).png" alt="Nkwapa Health logo" class="hero-logo" />
        <p class="hero-card-tagline">Connecting Care, Empowering Health</p>

        <div class="feature-list">
          <div class="feature-item">
            <span class="material-symbols-outlined feat-icon">health_metrics</span>
            <span>Digital medical records</span>
          </div>
          <div class="feature-item">
            <span class="material-symbols-outlined feat-icon">forum</span>
            <span>Secure staff messaging</span>
          </div>
          <div class="feature-item">
            <span class="material-symbols-outlined feat-icon">manage_accounts</span>
            <span>Role-based access control</span>
          </div>
          <div class="feature-item">
            <span class="material-symbols-outlined feat-icon">calendar_month</span>
            <span>Encounter &amp; appointment tracking</span>
          </div>
        </div>

        <!-- Inline teaser CTA -->
        <button class="card-signin-btn" @click="showSignIn = true">
          <span class="material-symbols-outlined" style="font-size:18px">login</span>
          Sign in to your account
        </button>
      </div>
    </main>
  </div>

  <FooterView />

  <!-- Modal -->
  <SignInModal v-model="showSignIn" />
</template>

<style scoped>
.home {
  min-height: calc(100vh - var(--footer-h));
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--green-50) 0%, var(--white) 60%);
}

.home-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--green-100);
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.home-nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--green);
}

.brand-logo {
  width: 36px; height: 36px;
  border-radius: 8px;
  border: 2px solid var(--green-200);
}

.home-nav-actions { display: flex; gap: 8px; }

.home-hero {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 2rem;
  width: 100%;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--green-100);
  color: var(--green-800);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  margin-bottom: 1.2rem;
}

.hero-content h1 {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1.2;
  margin-bottom: 1rem;
}

.hero-sub {
  color: var(--gray-600);
  font-size: 1.05rem;
  line-height: 1.7;
  margin-bottom: 2rem;
  max-width: 460px;
}

.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }

.hero-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(48, 135, 108, 0.12);
  border: 1px solid var(--green-100);
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.hero-logo {
  width: 90px; height: 90px;
  border-radius: 16px;
  border: 3px solid var(--green-200);
}

.hero-card-tagline {
  font-size: 0.95rem;
  color: var(--green-700);
  font-weight: 600;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--gray-700);
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-sm);
  background: var(--green-50);
}

.feat-icon {
  font-size: 18px !important;
  color: var(--green);
  flex-shrink: 0;
}

.card-signin-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.7rem 1rem;
  background: var(--green);
  color: var(--white);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: var(--font);
  margin-top: 0.25rem;
}

.card-signin-btn:hover { background: var(--green-700); }

@media (max-width: 768px) {
  .home-hero {
    grid-template-columns: 1fr;
    padding: 2rem 1rem;
    gap: 2rem;
  }
  .hero-content h1 { font-size: 1.8rem; }
  .hero-card { order: -1; }
}
</style>