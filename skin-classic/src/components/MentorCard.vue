<script setup>
import { computed } from "vue";

const props = defineProps({
  mentor: { type: Object, required: true },
  band: { type: Object, default: () => ({ key: "", label: "" }) },
  mine: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});

defineEmits(["pick"]);

function splitTags(value) {
  return String(value || "")
    .split(/[、,，/;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const photoUrl = computed(() =>
  props.mentor.photo ? import.meta.env.BASE_URL + "photos/" + props.mentor.photo : ""
);
const full = computed(() => props.band.key === "full");
const industryTags = computed(() => splitTags(props.mentor.industry));
const expertiseTags = computed(() => splitTags(props.mentor.expertise));

const buttonLabel = computed(() => {
  if (props.mine) return "已选择 · 点击更换请选其他导师";
  if (full.value) return "名额已满";
  return "选择这位导师";
});
</script>

<template>
  <article class="card" :class="{ mine, full: full && !mine }">
    <img v-if="photoUrl" class="avatar" :src="photoUrl" :alt="mentor.name" loading="lazy" />
    <div v-else class="avatar-fallback" aria-hidden="true">{{ mentor.name.slice(0, 1) }}</div>

    <p class="badge">2026-2027 校外导师</p>
    <h2>{{ mentor.name }}</h2>
    <p class="org">{{ mentor.org || "—" }}</p>
    <p v-if="mentor.dept" class="dept">{{ mentor.dept }}</p>
    <p class="title">{{ mentor.title || "—" }}</p>

    <p class="quota" :class="'band-' + (band.key || 'none')">
      <span class="dot" aria-hidden="true"></span>{{ band.label || "名额待定" }}
    </p>

    <div v-if="industryTags.length" class="tag-row">
      <span class="tag-label">行业领域</span>
      <ul class="tags">
        <li v-for="tag in industryTags" :key="tag">{{ tag }}</li>
      </ul>
    </div>

    <div v-if="expertiseTags.length" class="tag-row">
      <span class="tag-label">擅长方向</span>
      <ul class="tags gold">
        <li v-for="tag in expertiseTags" :key="tag">{{ tag }}</li>
      </ul>
    </div>

    <dl v-if="mentor.timePref" class="meta">
      <div>
        <dt>辅导时间</dt>
        <dd>{{ mentor.timePref }}{{ mentor.online ? " · 线上为主" : "" }}</dd>
      </div>
    </dl>

    <button
      v-if="selectable"
      type="button"
      class="btn pick"
      :disabled="busy || mine || full"
      @click="$emit('pick', mentor)"
    >
      {{ buttonLabel }}
    </button>
    <p v-else-if="mine" class="mine-note">这是你当前选择的导师</p>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 28px 22px 24px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  overflow: hidden;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.card::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 88px;
  background: linear-gradient(180deg, rgba(75, 29, 110, 0.08), transparent);
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 22px 46px rgba(36, 16, 51, 0.14);
}

.card.mine {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(196, 163, 90, 0.5), var(--shadow);
}

.card.full { opacity: 0.72; }

.avatar,
.avatar-fallback {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 18px;
  border: 3px solid #fff;
  box-shadow:
    0 0 0 3px var(--gold),
    0 10px 22px rgba(36, 16, 51, 0.16);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, var(--purple), #8a52b5);
  color: #fff;
  font-size: 46px;
  font-weight: 650;
}

.badge {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--gold);
  font-weight: 650;
}

h2 {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 650;
}

.org {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--purple);
  font-weight: 600;
}

.dept,
.title {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

.title {
  margin-top: 8px;
  color: var(--ink);
}

.quota {
  margin: 16px 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 650;
  background: var(--good-bg);
  color: var(--good);
}

.quota .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

/* 四档名额只给感觉，不给精确人数，精确数字留给管理端与导师端。 */
.quota.band-full {
  background: var(--bad-bg);
  color: var(--bad);
}

.quota.band-tight {
  background: rgba(200, 74, 49, 0.1);
  color: #b2431f;
}

.quota.band-hurry {
  background: rgba(196, 163, 90, 0.16);
  color: #8a6a1f;
}

.meta {
  margin: 0 0 10px;
  width: 100%;
  display: grid;
  gap: 8px;
  text-align: left;
}

.meta dt {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 2px;
}

.meta dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.tag-row {
  width: 100%;
  text-align: left;
  margin-bottom: 10px;
}

.tag-label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 5px;
}

.tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0;
  margin: 0;
}

.tags li {
  font-size: 12px;
  border-radius: 999px;
  padding: 3px 10px;
  background: rgba(75, 29, 110, 0.07);
  color: var(--purple);
}

.tags.gold li {
  background: rgba(196, 163, 90, 0.14);
  color: #7c5f1b;
}

.tag-row + .meta { margin-top: 4px; }

.pick {
  margin-top: auto;
  width: 100%;
}

.mine-note {
  margin: auto 0 0;
  font-size: 13px;
  color: var(--gold);
  font-weight: 650;
}
</style>
