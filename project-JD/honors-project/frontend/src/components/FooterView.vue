<template>
  <footer class="footer">
    <div class="footer-brand">
      <img src="/Nkwapa Watch (3).png" alt="Akomapa Health" class="footer-logo" />
      <span>Nkwapa Health</span>
    </div>
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Use</a>
      <a href="#">Contact Us</a>
    </div>
    <p class="footer-copy">© 2025 Nkwapa Health. All rights reserved.</p>
  </footer>
</template>

<style scoped>
.footer {
  height: var(--footer-h);
  background: var(--white);
  border-top: 2px solid var(--green-100);
  padding: 0 1.5rem;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.8rem; color: var(--gray-600);
  flex-shrink: 0;
}
.footer-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--green); }
.footer-logo { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--green-200); }
.footer-links { display: flex; gap: 1.2rem; }
.footer-links a { color: var(--gray-500); font-size: 0.8rem; transition: color 0.2s; }
.footer-links a:hover { color: var(--green); text-decoration: underline; }
.footer-copy { color: var(--gray-400); }
@media (max-width: 600px) {
  .footer { flex-wrap: wrap; height: auto; padding: 0.8rem 1rem; gap: 0.5rem; }
  .footer-copy { display: none; }
}
</style>