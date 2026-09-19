<script setup>
defineProps({
  size: { type: [Number, String], default: 40 },
});
</script>

<template>
  <svg
    class="imba-face"
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="32" fill="#2d3170" />
    <circle cx="32" cy="32" r="29" fill="none" stroke="#c4a35a" stroke-width="3.2" />
    <circle cx="32" cy="38.2" r="16.6" fill="#f8e6bf" />
    <ellipse cx="22.6" cy="41.2" rx="3.6" ry="2.2" fill="#e89a96" opacity="0.78" />
    <ellipse cx="41.4" cy="41.2" rx="3.6" ry="2.2" fill="#e89a96" opacity="0.78" />
    <circle cx="26" cy="37.4" r="2.15" fill="#1f2152" />
    <circle cx="38" cy="37.4" r="2.15" fill="#1f2152" />
    <circle cx="26.7" cy="36.7" r="0.6" fill="#fff" />
    <circle cx="38.7" cy="36.7" r="0.6" fill="#fff" />
    <path d="M26 44.2c2 2.8 10 2.8 12 0" fill="none" stroke="#1f2152" stroke-width="1.8" stroke-linecap="round" />
    <path d="M13.6 24.2 32 13.4 50.4 24.2 32 30.2Z" fill="#d4b36a" />
    <path d="M13.6 24.2 32 27.2 50.4 24.2 32 21.4Z" fill="#c4a35a" />
    <rect x="23.2" y="23.2" width="17.6" height="7.4" rx="1.5" fill="#16183f" />
    <path d="M50.2 24.2v10.2" stroke="#e6c97a" stroke-width="1.7" stroke-linecap="round" />
    <circle cx="50.2" cy="36.2" r="2.3" fill="#f0d78a" />
  </svg>
</template>

<style scoped>
.imba-face {
  display: block;
  flex-shrink: 0;
}
</style>
