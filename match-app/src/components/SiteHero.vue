<script setup>
import { t } from "../i18n";

defineProps({
  title: { type: String, required: true },
  lede: { type: String, default: "" },
  note: { type: String, default: "" },
  eyebrow: { type: String, default: "" },
});
</script>

<template>
  <header class="hero">
    <div class="hero-inner">
      <p class="eyebrow">{{ eyebrow || t("home.eyebrow") }}</p>
      <h1>{{ title }}</h1>
      <p v-if="lede" class="lede">{{ lede }}</p>
      <p v-if="note" class="sort-note">{{ note }}</p>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, var(--navy-deep) 0%, var(--navy) 52%, #2a3878 100%);
  color: #fff;
}

.hero-inner {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  padding: 44px 24px 40px;
}

.eyebrow {
  margin: 0 0 10px;
  letter-spacing: 0.08em;
  font-size: 12px;
  font-weight: 650;
  color: var(--gold-soft);
}

h1 {
  margin: 0 0 10px;
  font-size: 36px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: #fff;
}

.lede {
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 17px;
}

.sort-note {
  display: inline-block;
  margin: 0;
  padding: 6px 14px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(196, 163, 90, 0.45);
  color: #fff;
  font-size: 13px;
}

@media (max-width: 800px) {
  h1 { font-size: 26px; }
}
</style>
