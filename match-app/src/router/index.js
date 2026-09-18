import { createRouter, createWebHistory } from "vue-router";
import DirectoryView from "../views/DirectoryView.vue";
import AdminView from "../views/AdminView.vue";

const router = createRouter({
  history: createWebHistory("/match/"),
  routes: [
    { path: "/", name: "directory", component: DirectoryView },
    { path: "/admin", name: "admin", component: AdminView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
