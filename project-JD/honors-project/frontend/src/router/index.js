import MainFeed from '@/components/MainFeed.vue'
import ChatView from '@/views/ChatView.vue'
import HomeView from '@/views/HomeView.vue'
import JoinUs from '@/views/JoinUs.vue'
import MainView from '@/views/MainView.vue'
import ProfileView from '@/views/ProfileView.vue'
import SearchView from '@/views/SearchView.vue'
import MessageList from '@/views/MessageList.vue'
import EditView from '@/views/EditView.vue'
import AppointmentsView from '@/views/AppointmentsView.vue'
import { createRouter, createWebHistory } from 'vue-router'

// Validate the JWT: it must exist AND not be expired.
// A leftover/expired token should NOT count as logged in.
const isLoggedIn = () => {
  const token = localStorage.getItem('token')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // Expired — clean it up so we don't get stuck "logged in"
      localStorage.removeItem('token')
      return false
    }
    return true
  } catch {
    // Malformed token — clear it
    localStorage.removeItem('token')
    return false
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { authRequired: false }
    },
    {
      path: '/signin',
      name: 'signin',
      redirect: { name: 'home', query: { modal: 'signin' } },
    },
    {
      path: '/main',
      component: MainView,
      meta: { authRequired: true },
      children: [
        {
          path: '',
          name: 'main',
          components: { focus: MainFeed },
          meta: { authRequired: true }
        },
        {
          path: '/profile',
          name: 'profile',
          components: { focus: ProfileView },
          meta: { authRequired: true }
        },
        {
          path: '/message/:user_id',
          name: 'message',
          components: { focus: ChatView },
          meta: { authRequired: true }
        },
        {
          path: '/mymessages/:user_id',
          name: 'mymessages',
          components: { focus: MessageList },
          meta: { authRequired: true }
        },
        {
          path: '/update-user/:user_id',
          name: 'updateuser',
          components: { focus: EditView },
          meta: { authRequired: true }
        },
        {
          path: '/search',
          name: 'search',
          components: { focus: SearchView },
          props: true,
          meta: { authRequired: true }
        },
        {
          path: '/appointments',
          name: 'appointments',
          components: { focus: AppointmentsView },
          meta: { authRequired: true }
        }
      ]
    },
    {
      path: '/joinus',
      name: 'joinus',
      component: JoinUs,
      meta: { authRequired: false }
    }
  ],
})

router.beforeEach((to) => {
  const loggedIn = isLoggedIn()

  // Use matched.some so nested child routes (e.g. /profile, /search) are caught too
  const needsAuth = to.matched.some((record) => record.meta.authRequired)

  if (needsAuth && !loggedIn) {
    return { name: 'home', query: { modal: 'signin' } }
  }

  if (to.name === 'home' && loggedIn && !to.query.modal) {
    return { name: 'main' }
  }
})

export default router