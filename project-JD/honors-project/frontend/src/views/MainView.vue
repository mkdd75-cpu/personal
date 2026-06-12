<script setup>
import HeaderView from '@/components/HeaderView.vue'
import FooterView from '@/components/FooterView.vue'
import SideBar from '@/components/SideBar.vue'
import RightFeed from '@/components/RightFeed.vue'
</script>

<template>
  <HeaderView />
  <div class="app-body">
    <SideBar />
    <main class="main-content">
      <RouterView name="focus" />
    </main>
    <RightFeed />
  </div>
  <FooterView />
</template>

<style scoped>
.app-body {
  display: flex;
  flex: 1;
  height: calc(100vh - var(--header-h) - var(--footer-h));
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--gray-50);
}

@media (max-width: 768px) {
  .app-body { flex-direction: column; height: auto; overflow: visible; }
  .main-content { overflow-y: visible; }
}
</style>