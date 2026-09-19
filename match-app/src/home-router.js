import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import JobsView from "./views/JobsView.vue";
import CoordView from "./views/CoordView.vue";
import AdminView from "./views/AdminView.vue";
import CourseView from "./views/CourseView.vue";

const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/jobs", name: "jobs", component: JobsView },
    { path: "/coord", name: "coord", component: CoordView },
    { path: "/courses", name: "courses", component: CourseView },
    { path: "/admin", name: "admin", component: AdminView },
  ],
});

export default router;
