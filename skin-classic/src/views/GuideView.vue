<script setup>
import { computed, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import guide from "../data/guide";

const query = ref("");
const copied = ref("");

function searchText(item) {
  return [
    item.unit,
    item.desc,
    item.email,
    item.tel,
    item.addr,
    item.wechat,
    item.keywords,
    (item.links || []).map((l) => l.label + " " + l.url).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function match(list) {
  const q = query.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => searchText(item).indexOf(q) >= 0);
}

const depts = computed(() => match(guide.depts));
const housing = computed(() => match(guide.housing));
const empty = computed(() => !depts.value.length && !housing.value.length);

function rows(item) {
  const list = [];
  if (item.email) list.push({ type: "email", label: "邮箱", value: item.email, href: "mailto:" + item.email });
  if (item.tel) {
    list.push({ type: "tel", label: "电话", value: item.tel, href: "tel:" + item.tel.replace(/\s/g, "") });
  }
  (item.links || []).forEach((link) => {
    list.push({ type: "link", label: link.label || "官网", value: link.url, href: link.url, external: true });
  });
  if (item.addr) list.push({ type: "addr", label: "地址", value: item.addr, href: "" });
  if (item.wechat) list.push({ type: "wechat", label: "公众号", value: item.wechat, href: "" });
  return list;
}

async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    // 非安全上下文拿不到剪贴板，退回到隐藏 textarea。
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  copied.value = value;
  window.setTimeout(() => {
    if (copied.value === value) copied.value = "";
  }, 1400);
}
</script>

<template>
  <SiteHero
    title="在读学生常用指引"
    eyebrow="香港中文大学（深圳）经管学院 信息管理与商业分析硕士项目"
    lede="联系方式、常用网址，一页看清"
    note="点链接直达，点「复制」即可粘贴"
  />

  <nav class="entries">
    <a href="/">平台首页</a>
    <a href="/match">校外导师匹配</a>
    <a href="/match/mentor">导师入口</a>
  </nav>

  <main class="wrap">
    <section class="toolbar">
      <label class="search">
        <span class="sr-only">搜索部门或事项</span>
        <input v-model="query" type="search" placeholder="搜索缴费 / 实习 / 住宿 / 证明 / 书院…" />
      </label>
      <p class="count">共 {{ depts.length + housing.length }} 条</p>
    </section>

    <p v-if="empty" class="alert error">没有匹配的部门，换个关键词试试。</p>

    <template v-if="depts.length">
      <h2 class="section">常用联系方式</h2>
      <div class="cards">
        <article v-for="item in depts" :key="item.unit" class="card">
          <h3>{{ item.unit }}</h3>
          <p v-if="item.desc" class="desc">{{ item.desc }}</p>
          <ul class="rows">
            <li v-for="row in rows(item)" :key="row.label + row.value">
              <span class="lab">{{ row.label }}</span>
              <a
                v-if="row.href"
                class="val"
                :href="row.href"
                :target="row.external ? '_blank' : undefined"
                :rel="row.external ? 'noopener' : undefined"
              >{{ row.value }}</a>
              <span v-else class="val">{{ row.value }}</span>
              <button type="button" :class="{ ok: copied === row.value }" @click="copy(row.value)">
                {{ copied === row.value ? "已复制" : "复制" }}
              </button>
            </li>
          </ul>
        </article>
      </div>
    </template>

    <template v-if="housing.length">
      <h2 class="section">
        住宿相关 <small>入住 / 退宿等事宜</small>
      </h2>
      <div class="cards">
        <article v-for="item in housing" :key="item.unit" class="card house">
          <h3>{{ item.unit }}</h3>
          <p v-if="item.desc" class="desc">{{ item.desc }}</p>
          <ul class="rows">
            <li v-for="row in rows(item)" :key="row.label + row.value">
              <span class="lab">{{ row.label }}</span>
              <a
                v-if="row.href"
                class="val"
                :href="row.href"
                :target="row.external ? '_blank' : undefined"
                :rel="row.external ? 'noopener' : undefined"
              >{{ row.value }}</a>
              <span v-else class="val">{{ row.value }}</span>
              <button type="button" :class="{ ok: copied === row.value }" @click="copy(row.value)">
                {{ copied === row.value ? "已复制" : "复制" }}
              </button>
            </li>
          </ul>
        </article>
      </div>
    </template>
  </main>
</template>

<style scoped>
.entries {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 20px 0 -4px;
}

.entries a {
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 252, 248, 0.9);
  color: var(--purple);
  text-decoration: none;
}

.entries a:hover { border-color: var(--gold); }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.search { flex: 1; min-width: 260px; }

.search input {
  width: 100%;
  font: inherit;
  padding: 11px 16px;
  border-radius: 999px;
  border: 1px solid #ddd2c4;
  background: #fff;
}

.search input:focus {
  outline: none;
  border-color: var(--purple);
}

.count { margin: 0; font-size: 13px; color: var(--muted); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.section {
  margin: 26px 0 14px;
  font-size: 20px;
  color: var(--purple);
}

.section small {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px 20px 16px;
  box-shadow: var(--shadow);
}

.card.house { border-left: 3px solid var(--gold); }

.card h3 {
  margin: 0 0 8px;
  font-size: 17px;
}

.desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
  white-space: pre-wrap;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.rows li {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}

.lab { color: var(--muted); }

.val {
  color: var(--ink);
  word-break: break-all;
}

a.val { color: var(--purple); }

.rows button {
  border: 1px solid #ddd2c4;
  background: #fff;
  border-radius: 999px;
  padding: 2px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}

.rows button.ok {
  border-color: var(--good);
  color: var(--good);
}

@media (max-width: 600px) {
  .cards { grid-template-columns: 1fr; }
}
</style>
