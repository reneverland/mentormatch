<script setup>
import { computed } from "vue";
import { t } from "../i18n";

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
  if (props.mine) return t("card.mineBtn");
  if (full.value) return t("card.full");
  return t("card.pick");
});

const bandLabel = computed(() => {
  const key = props.band && props.band.key;
  return key ? t("band." + key) : (props.band && props.band.label) || t("card.pending");
});
</script>

<template>
  <article class="card" :class="{ mine, full: full && !mine }">
    <img v-if="photoUrl" class="avatar" :src="photoUrl" :alt="mentor.name" loading="lazy" />
    <div v-else class="avatar-fallback" aria-hidden="true">{{ mentor.name.slice(0, 1) }}</div>

    <p class="badge">{{ t("card.badge") }}</p>
    <h2>{{ mentor.name }}</h2>
    <p class="org">{{ mentor.org || "—" }}</p>
    <p v-if="mentor.dept" class="dept">{{ mentor.dept }}</p>
    <p class="title">{{ mentor.title || "—" }}</p>

    <p class="quota" :class="'band-' + (band.key || 'none')">
      <span class="dot" aria-hidden="true"></span>{{ bandLabel }}
    </p>

    <div v-if="industryTags.length" class="tag-row">
      <span class="tag-label">{{ t("card.industry") }}</span>
      <ul class="tags">
        <li v-for="tag in industryTags" :key="tag">{{ tag }}</li>
      </ul>
    </div>

    <div v-if="expertiseTags.length" class="tag-row">
      <span class="tag-label">{{ t("card.expertise") }}</span>
      <ul class="tags gold">
        <li v-for="tag in expertiseTags" :key="tag">{{ tag }}</li>
      </ul>
    </div>

    <dl v-if="mentor.timePref" class="meta">
      <div>
        <dt>{{ t("card.time") }}</dt>
        <dd>{{ mentor.timePref }}{{ mentor.online ? t("card.online") : "" }}</dd>
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
    <p v-else-if="mine" class="mine-note">{{ t("card.mineNote") }}</p>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
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
  background: linear-gradient(180deg, rgba(31, 33, 82, 0.06), transparent);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(31, 33, 82, 0.1);
}

.card.mine {
  border-color: var(--purple);
  box-shadow: 0 0 0 2px rgba(31, 33, 82, 0.18), var(--shadow);
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
    0 0 0 3px rgba(31, 33, 82, 0.28),
    0 8px 18px rgba(31, 33, 82, 0.12);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, var(--navy), var(--navy-mid));
  color: #fff;
  font-size: 46px;
  font-weight: 650;
}

.badge {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--purple);
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

/* 名额只给感觉，不看精确人数：>=20 比较充裕，10–19 相对充裕，5–9 出手要快哦，<5 紧张。 */
.quota.band-full {
  background: var(--bad-bg);
  color: var(--bad);
}

.quota.band-tight {
  background: rgba(200, 74, 49, 0.1);
  color: #b2431f;
}

.quota.band-hurry {
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
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
  background: rgba(31, 33, 82, 0.07);
  color: var(--navy);
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
  color: var(--purple);
  font-weight: 650;
}
</style>
