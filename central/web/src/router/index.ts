import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthenticated } from '../auth/session';
import LoginView from '../views/LoginView.vue';
import CallbackView from '../views/CallbackView.vue';
import SitesView from '../views/SitesView.vue';
import StudiesView from '../views/StudiesView.vue';
import SubmissionsView from '../views/SubmissionsView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/sites' },
  { path: '/login', component: LoginView },
  { path: '/callback', component: CallbackView },
  { path: '/sites', component: SitesView, meta: { auth: true } },
  { path: '/studies', component: StudiesView, meta: { auth: true } },
  { path: '/submissions', component: SubmissionsView, meta: { auth: true } },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  if (to.meta.auth && !isAuthenticated()) return '/login';
  return true;
});
