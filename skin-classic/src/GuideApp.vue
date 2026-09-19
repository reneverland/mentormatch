<script setup>
import GuideView from "./views/GuideView.vue";
import SiteFooter from "./components/SiteFooter.vue";
</script>

<template>
  <GuideView />
  <SiteFooter
    note="本指引根据最新整理内容生成，仅供参考，以学校官方通知为准。"
    :show-cbit="false"
  />
</template>
