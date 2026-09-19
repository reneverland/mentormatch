<script setup>
import { computed, onMounted, ref, watch } from "vue";
import SiteHero from "../components/SiteHero.vue";
import JobCard from "../components/JobCard.vue";
import SiteLoginModal from "../components/SiteLoginModal.vue";
import api from "../api";
import { studentToken } from "../session";
import { t, te } from "../i18n";

const loading = ref(true);
const error = ref("");
const notice = ref("");
const jobs = ref([]);
const ad = ref({ adTitle: "", adText: "", adImage: "" });
const appliedIds = ref([]);
const filter = ref("all");
const selected = ref(null);
const note = ref("");
const busy = ref(false);
const showLogin = ref(false);
const hasResume = ref(true);

const openJobs = computed(() => jobs.value.filter((j) => j.status === "published"));
const closedJobs = computed(() => jobs.value.filter((j) => j.status === "closed"));

const shown = computed(() => {
  const list = openJobs.value;
  if (filter.value === "intern") return list.filter((j) => j.type === "intern");
  if (filter.value === "fulltime") return list.filter((j) => j.type === "fulltime");
  return list;
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.jobs(studentToken.value);
    jobs.value = data.jobs || [];
    ad.value = data.ad || ad.value;
    appliedIds.value = data.appliedIds || [];
    if (selected.value) {
      selected.value = jobs.value.find((j) => j.id === selected.value.id) || selected.value;
    }
    if (studentToken.value) {
      try {
        const state = await api.state(studentToken.value);
        hasResume.value = Boolean(state.me && state.me.resume);
      } catch (err) {
        hasResume.value = true;
      }
    }
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

function applied(job) {
  return appliedIds.value.indexOf(job.id) !== -1;
}

async function apply() {
  if (!selected.value) return;
  if (!studentToken.value) {
    showLogin.value = true;
    return;
  }
  error.value = "";
  notice.value = "";
  busy.value = true;
  try {
    const data = await api.jobApply(studentToken.value, selected.value.id, note.value.trim());
    notice.value = te(data.message) || t("jobs.appliedOk");
    note.value = "";
    await load();
  } catch (err) {
    error.value = te(err.message);
    if (/登录/.test(err.message)) showLogin.value = true;
  } finally {
    busy.value = false;
  }
}

function onAuthed() {
  showLogin.value = false;
  load();
}

watch(studentToken, load);
onMounted(load);
</script>

<template>
  <SiteHero
    :title="t('jobs.title')"
    :lede="t('jobs.lede')"
    :note="t('jobs.note')"
  />

  <main class="wrap">
    <section v-if="ad.adTitle || ad.adText || ad.adImage" class="ad">
      <img v-if="ad.adImage" :src="ad.adImage" alt="" />
      <div>
        <h2 v-if="ad.adTitle">{{ ad.adTitle }}</h2>
        <p v-if="ad.adText">{{ ad.adText }}</p>
      </div>
    </section>

    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="notice" class="alert ok">{{ notice }}</p>
    <p v-if="loading" class="muted">{{ t("jobs.loading") }}</p>

    <div class="toolbar">
      <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">{{ t("jobs.all") }}</button>
      <button type="button" :class="{ on: filter === 'fulltime' }" @click="filter = 'fulltime'">{{ t("jobs.fulltime") }}</button>
      <button type="button" :class="{ on: filter === 'intern' }" @click="filter = 'intern'">{{ t("jobs.intern") }}</button>
    </div>

    <div class="grid">
      <button
        v-for="job in shown"
        :key="job.id"
        class="pick"
        type="button"
        @click="selected = job; notice = ''; error = ''"
      >
        <JobCard :job="job" compact />
        <span v-if="applied(job)" class="done">{{ t("jobs.applied") }}</span>
      </button>
      <p v-if="!loading && !shown.length" class="muted">{{ t("jobs.empty") }}</p>
    </div>

    <section v-if="selected" class="detail panel">
      <JobCard :job="selected" />
      <div v-if="selected.status === 'published'" class="apply">
        <label class="field">
          <span>{{ t("jobs.noteLabel") }}</span>
          <textarea v-model="note" rows="3" :placeholder="t('jobs.notePh')"></textarea>
        </label>
        <p class="hint">
          {{ t("jobs.hint", { email: selected.cvEmail || t("jobs.defaultInbox") }) }}
        </p>
        <p v-if="studentToken && !hasResume" class="alert error">{{ t("jobs.noResume") }}</p>
        <button
          v-if="!studentToken"
          class="btn"
          type="button"
          @click="showLogin = true"
        >{{ t("jobs.loginApply") }}</button>
        <button
          v-else
          class="btn"
          type="button"
          :disabled="busy || applied(selected) || !hasResume"
          @click="apply"
        >
          {{ applied(selected) ? t("jobs.applied") : busy ? t("jobs.applying") : t("jobs.apply") }}
        </button>
      </div>
      <p v-else class="hint">{{ t("jobs.closedHint") }}</p>
    </section>

    <section v-if="closedJobs.length" class="closed">
      <h2 class="section">{{ t("jobs.closed") }}</h2>
      <div class="grid">
        <JobCard v-for="job in closedJobs" :key="job.id" :job="job" compact />
      </div>
    </section>
  </main>

  <SiteLoginModal v-if="showLogin" @close="onAuthed(); showLogin = false" />
</template>

<style scoped>
.ad {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 22px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--line);
  border-left: 3px solid var(--gold);
  border-radius: 8px;
}

.ad img {
  width: 120px;
  height: auto;
  object-fit: cover;
  border-radius: 6px;
}

.ad h2 { margin: 0 0 6px; font-size: 18px; }
.ad p { margin: 0; color: var(--muted); font-size: 14px; }

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.toolbar button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 999px;
  padding: 6px 14px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  color: var(--muted);
}

.toolbar button.on {
  background: var(--navy);
  border-color: transparent;
  color: #fff;
  font-weight: 650;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.pick {
  position: relative;
  border: 0;
  padding: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.pick:hover :deep(.job) {
  box-shadow: 0 14px 28px rgba(31, 33, 82, 0.12);
}

.done {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-weight: 650;
  color: var(--good);
  background: var(--good-bg);
  border-radius: 999px;
  padding: 2px 8px;
}

.apply { margin-top: 16px; }
.apply .btn { min-width: 180px; }

.section {
  margin: 8px 0 14px;
  font-size: 20px;
  color: var(--purple);
}

.closed { margin-top: 12px; }
</style>
