<script setup>
import SiteNav from "./components/SiteNav.vue";
import SiteFooter from "./components/SiteFooter.vue";
import { t } from "./i18n";
</script>

<template>
  <SiteNav />
  <router-view />
  <SiteFooter :note="t('footer.home')" />
</template>
