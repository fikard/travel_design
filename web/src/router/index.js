import { createRouter, createWebHistory } from 'vue-router';
const routes = [
  { path: '/', component: () => import('../views/HomeView.vue') },
  { path: '/province/:code', component: () => import('../views/ProvinceView.vue') },
  { path: '/city/:code', component: () => import('../views/CityView.vue') },
  { path: '/place/:id', component: () => import('../views/PlaceDetailView.vue') },
  { path: '/topics', component: () => import('../views/TopicsView.vue') },
  { path: '/topic/:id', component: () => import('../views/TopicDetailView.vue') },
  { path: '/search', component: () => import('../views/SearchView.vue') },
];
export default createRouter({ history: createWebHistory(), routes });