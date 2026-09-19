<script setup>
import SiteHero from "../components/SiteHero.vue";

const openCards = [
  {
    href: "/match",
    title: "校外导师匹配",
    desc: "注册后在开放时间内选择校外导师，一人一位，先到先得。",
  },
  {
    href: "/guide",
    title: "在读生指引",
    desc: "常用联系方式、书院住宿与办事入口，点链接直达或复制。",
  },
  {
    href: "/match/mentor",
    title: "导师工作台",
    desc: "查看本组学生与简历，向组内群发通知，修改登录密码。",
  },
  {
    href: "/match/admin",
    title: "管理端",
    desc: "开放时间、邀请码、学生调组与导师账号，仅项目组使用。",
  },
];

const soonCards = [
  {
    title: "校友资源",
    desc: "连接在读生与校友网络，后续开放查询与对接。",
  },
  {
    title: "发布实习 / 就业机会",
    desc: "实习与全职信息将在此发布，便于同学统一查看。",
  },
  {
    title: "预约 Coordinator 交流",
    desc: "与项目 Coordinator 预约沟通学习、选课与职业发展。",
  },
];
</script>

<template>
  <SiteHero
    title="信息管理与商业分析硕士项目"
    lede="IMBA 学生服务平台"
    note="先开放导师匹配与在读指引，校友与就业相关能力后续接入"
  />

  <main class="wrap">
    <h2 class="section">已开放</h2>
    <div class="cards">
      <a v-for="card in openCards" :key="card.href" class="card open" :href="card.href">
        <h3>{{ card.title }}</h3>
        <p>{{ card.desc }}</p>
        <span class="go">进入</span>
      </a>
    </div>

    <h2 class="section">即将上线</h2>
    <div class="cards">
      <article v-for="card in soonCards" :key="card.title" class="card soon">
        <p class="soon-tag">即将上线</p>
        <h3>{{ card.title }}</h3>
        <p>{{ card.desc }}</p>
      </article>
    </div>
  </main>
</template>

<style scoped>
.section {
  margin: 8px 0 14px;
  font-size: 20px;
  color: var(--purple);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 20px 22px 18px;
  box-shadow: var(--shadow);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  min-height: 168px;
}

.card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--muted);
}

.card.open:hover {
  transform: translateY(-4px);
  border-color: var(--gold);
}

.card.open .go {
  margin-top: auto;
  padding-top: 16px;
  font-size: 13px;
  font-weight: 650;
  color: var(--purple);
}

.card.soon {
  opacity: 0.72;
  cursor: default;
}

.soon-tag {
  margin: 0 0 8px !important;
  font-size: 12px !important;
  font-weight: 650;
  color: var(--gold) !important;
}
</style>
