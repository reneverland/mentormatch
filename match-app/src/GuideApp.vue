<script setup>
import SiteNav from "./components/SiteNav.vue";
import GuideView from "./views/GuideView.vue";
import SiteFooter from "./components/SiteFooter.vue";
import { t } from "./i18n";
</script>

<template>
  <SiteNav />
  <GuideView />
  <SiteFooter :note="t('footer.guide')" :show-cbit="false" />
</template>
