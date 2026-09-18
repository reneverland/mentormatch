<script setup>
const badgeUrl = import.meta.env.BASE_URL + "reneverland-badge.svg";
const cbitBadgeUrl = import.meta.env.BASE_URL + "cbit-badge.svg";
</script>

<template>
  <router-view />
  <footer class="foot">
    <p>
      香港中文大学（深圳）经管学院 信息管理与商业分析硕士项目 · 校外导师匹配 ·
      导师按姓名拼音 A–Z 排列，不代表排名。
    </p>
    <p class="badge-line">
      <a href="https://github.com/reneverland/" target="_blank" rel="noopener">
        <!-- 徽章 SVG 本地托管，避免校内网络取不到 shields.io 时页脚空白。 -->
        <img :src="badgeUrl" alt="GitHub reneverland" width="139" height="20" />
      </a>
      <a href="https://cbit.cuhk.edu.cn/" target="_blank" rel="noopener">
        <img :src="cbitBadgeUrl" alt="CBIT" width="118" height="20" />
      </a>
    </p>
  </footer>
</template>

<style scoped>
.foot {
  border-top: 1px solid var(--line);
  background: #fffaf3;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 22px 20px 32px;
}

.foot p {
  max-width: 880px;
  margin: 0 auto;
  line-height: 1.7;
}

.badge-line {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.badge-line img {
  height: 20px;
  vertical-align: middle;
}
</style>
