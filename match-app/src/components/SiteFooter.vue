<script setup>
import { t } from "../i18n";

defineProps({
  note: {
    type: String,
    default: "",
  },
  showCbit: { type: Boolean, default: true },
});

const badgeUrl = import.meta.env.BASE_URL + "reneverland-badge.svg";
const cbitBadgeUrl = import.meta.env.BASE_URL + "cbit-badge.svg";
const crestUrl = import.meta.env.BASE_URL + "cuhk-logo.png";
</script>

<template>
  <footer class="foot">
    <img class="crest" :src="crestUrl" :alt="t('footer.crest')" width="200" height="94" />
    <p class="meta">
      <span class="note">{{ note || t("footer.default") }}</span>
      <span class="badge-line">
        <a href="https://github.com/reneverland/" target="_blank" rel="noopener">
          <!-- 徽章 SVG 本地托管，避免校内网络取不到 shields.io 时页脚空白。 -->
          <img :src="badgeUrl" alt="GitHub reneverland" width="139" height="20" />
        </a>
        <a v-if="showCbit" href="https://cbit.cuhk.edu.cn/" target="_blank" rel="noopener">
          <img :src="cbitBadgeUrl" alt="CBIT" width="118" height="20" />
        </a>
      </span>
    </p>
  </footer>
</template>

<style scoped>
.foot {
  border-top: 2px solid var(--gold);
  background: var(--navy-deep);
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  text-align: center;
  padding: 26px 20px 34px;
}

.crest {
  display: block;
  height: 68px;
  width: auto;
  margin: 0 auto 14px;
}

.meta {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px 12px;
  line-height: 1.7;
}

.note { min-width: 0; }

.badge-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  opacity: 0.42;
}

.badge-line:hover { opacity: 0.7; }

.badge-line img {
  height: 16px;
  vertical-align: middle;
}
</style>
