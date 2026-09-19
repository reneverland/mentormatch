<script setup>
import { t } from "../i18n";

defineProps({
  job: { type: Object, required: true },
  compact: { type: Boolean, default: false },
});

function typeLabel(type) {
  return type === "intern" ? t("jobs.intern") : t("jobs.fulltime");
}

function statusLabel(status) {
  if (status === "draft") return t("jobs.draft");
  if (status === "closed") return t("jobs.closed");
  return t("jobs.open");
}
</script>

<template>
  <article class="job" :class="[job.status, { compact }]">
    <div class="top">
      <p class="company">{{ job.company }}</p>
      <span class="tag">{{ typeLabel(job.type) }}</span>
      <span class="tag dim">{{ statusLabel(job.status) }}</span>
    </div>
    <h3>{{ job.title }}</h3>
    <p class="meta">
      <span v-if="job.city">{{ job.city }}</span>
      <span v-if="job.experience">{{ job.experience }}</span>
      <span v-if="job.education">{{ job.education }}</span>
      <span v-if="job.salary" class="pay">{{ job.salary }}</span>
    </p>
    <p v-if="job.audience" class="audience">{{ job.audience }}</p>
    <pre v-if="!compact && job.description" class="jd">{{ job.description }}</pre>
    <p v-if="!compact && job.cvEmail" class="cv">{{ t("jobs.cvTo", { email: job.cvEmail }) }}</p>
  </article>
</template>

<style scoped>
.job {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 3px solid var(--navy);
  border-radius: 8px;
  padding: 18px 20px 16px;
  box-shadow: var(--shadow);
}

.job.closed { opacity: 0.7; border-left-color: var(--line); }
.job.draft { border-left-color: var(--gold); }

.top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.company {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--navy);
}

.tag {
  font-size: 11px;
  font-weight: 650;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
}

.tag.dim { color: var(--muted); background: #eef1f6; }

h3 {
  margin: 8px 0 6px;
  font-size: 18px;
}

.meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 13px;
  color: var(--muted);
}

.pay { color: var(--navy); font-weight: 650; }

.audience {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.jd {
  margin: 12px 0 0;
  white-space: pre-wrap;
  font: inherit;
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink);
}

.cv {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.compact h3 { font-size: 16px; }
</style>
