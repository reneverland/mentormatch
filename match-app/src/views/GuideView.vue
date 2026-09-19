<script setup>
import { computed, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import guide from "../data/guide";
import { guideDisplay } from "../data/guide-en";
import { locale, t } from "../i18n";

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

function shown(item) {
  return guideDisplay(item, locale.value);
}

function rows(item) {
  const view = shown(item);
  const list = [];
  if (item.email) list.push({ type: "email", label: t("guide.email"), value: item.email, href: "mailto:" + item.email });
  if (item.tel) {
    list.push({ type: "tel", label: t("guide.tel"), value: item.tel, href: "tel:" + item.tel.replace(/\s/g, "") });
  }
  (view.links || []).forEach((link) => {
    list.push({ type: "link", label: link.label || t("guide.site"), value: link.url, href: link.url, external: true });
  });
  if (item.addr) list.push({ type: "addr", label: t("guide.addr"), value: item.addr, href: "" });
  if (item.wechat) list.push({ type: "wechat", label: t("guide.wechat"), value: item.wechat, href: "" });
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
    :title="t('guide.title')"
    :eyebrow="t('guide.eyebrow')"
    :lede="t('guide.lede')"
    :note="t('guide.note')"
  />

  <main class="wrap">
    <section class="toolbar">
      <label class="search">
        <span class="sr-only">{{ t("guide.search") }}</span>
        <input v-model="query" type="search" :placeholder="t('guide.searchPh')" />
      </label>
      <p class="count">{{ t("guide.count", { n: depts.length + housing.length }) }}</p>
    </section>

    <p v-if="empty" class="alert error">{{ t("guide.empty") }}</p>

    <template v-if="depts.length">
      <h2 class="section">{{ t("guide.depts") }}</h2>
      <div class="cards">
        <article v-for="item in depts" :key="item.unit" class="card">
          <h3>{{ shown(item).unit }}</h3>
          <p v-if="shown(item).desc" class="desc">{{ shown(item).desc }}</p>
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
                {{ copied === row.value ? t("guide.copied") : t("guide.copy") }}
              </button>
            </li>
          </ul>
        </article>
      </div>
    </template>

    <template v-if="housing.length">
      <h2 class="section">
        {{ t("guide.housing") }} <small>{{ t("guide.housingSub") }}</small>
      </h2>
      <div class="cards">
        <article v-for="item in housing" :key="item.unit" class="card house">
          <h3>{{ shown(item).unit }}</h3>
          <p v-if="shown(item).desc" class="desc">{{ shown(item).desc }}</p>
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
                {{ copied === row.value ? t("guide.copied") : t("guide.copy") }}
              </button>
            </li>
          </ul>
        </article>
      </div>
    </template>
  </main>
</template>

<style scoped>
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
  border-radius: 10px;
  border: 1px solid var(--line);
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
  border-radius: 8px;
  padding: 18px 20px 16px;
  box-shadow: var(--shadow);
}

.card.house { border-left: 3px solid var(--purple); }

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
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 10px;
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
