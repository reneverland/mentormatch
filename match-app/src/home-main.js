import { createApp } from "vue";
import HomeApp from "./HomeApp.vue";
import router from "./home-router";
import "./styles/base.css";

createApp(HomeApp).use(router).mount("#app");
