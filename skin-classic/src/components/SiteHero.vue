<script setup>
defineProps({
  title: { type: String, required: true },
  lede: { type: String, default: "信息管理与商业分析硕士项目" },
  note: { type: String, default: "" },
  eyebrow: { type: String, default: "香港中文大学（深圳）经管学院" },
});
</script>

<template>
  <header class="hero">
    <div class="hero-bar"></div>
    <div class="hero-ornament" aria-hidden="true"></div>
    <div class="hero-inner">
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="lede">{{ lede }}</p>
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
    linear-gradient(120deg, rgba(196, 163, 90, 0.16), transparent 28%),
    linear-gradient(160deg, var(--purple-deep), var(--purple) 55%, var(--purple-mid));
  color: #fff;
}

.hero-bar {
  height: 5px;
  background: linear-gradient(90deg, #8d6b2c, var(--gold), #efe1b3, var(--gold), #8d6b2c);
}

.hero-ornament {
  position: absolute;
  right: -80px;
  top: -90px;
  width: 320px;
  height: 320px;
  border: 1px solid rgba(243, 231, 197, 0.18);
  border-radius: 50%;
  box-shadow: inset 0 0 0 18px rgba(243, 231, 197, 0.05);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  padding: 48px 24px 40px;
}

.eyebrow {
  margin: 0 0 10px;
  letter-spacing: 0.16em;
  font-size: 12px;
  color: var(--gold-soft);
}

h1 {
  margin: 0 0 10px;
  font-size: 38px;
  font-weight: 650;
  letter-spacing: 0.03em;
}

.lede {
  margin: 0 0 18px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 17px;
}

.sort-note {
  display: inline-block;
  margin: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(243, 231, 197, 0.38);
  color: var(--gold-soft);
  font-size: 13px;
}

@media (max-width: 640px) {
  h1 { font-size: 28px; }
}
</style>
