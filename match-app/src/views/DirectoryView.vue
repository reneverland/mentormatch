<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MentorCard from "../components/MentorCard.vue";
import MessageFeed from "../components/MessageFeed.vue";
import LoginView from "./LoginView.vue";
import mentors from "../data/mentors";
import api from "../api";
import { studentToken, setStudentToken } from "../session";
import { t, te, formatDateTime } from "../i18n";

const loading = ref(true);
const error = ref("");
const notice = ref("");
const busyId = ref("");
const query = ref("");
const bands = ref({});
const me = ref(null);
const messages = ref([]);
const showMessages = ref(true);
const windowState = ref({ open: false, openFrom: "", openTo: "" });
const confirmTarget = ref(null);
const authPrompt = ref(false);
const closedPrompt = ref(false);
const showGate = ref(false);
const nowTick = ref(Date.now());
let tickTimer = 0;

const sorted = computed(() =>
  mentors.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
);

const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return sorted.value;
  return sorted.value.filter((m) =>
    [m.name, m.org, m.dept, m.title, m.industry, m.expertise]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
});

const grouped = computed(() => {
  const groups = [];
  let last = "";
  shown.value.forEach((mentor) => {
    if (mentor.letter !== last) {
      groups.push({ letter: mentor.letter, items: [] });
      last = mentor.letter;
    }
    groups[groups.length - 1].items.push(mentor);
  });
  return groups;
});

const myMentor = computed(() =>
  me.value && me.value.mentorId ? mentors.find((m) => m.id === me.value.mentorId) : null
);

const windowNote = computed(() => {
  const { open, openFrom, openTo } = windowState.value;
  if (open) return t("match.openNow") + (openTo ? t("match.openUntil", { time: formatTime(openTo) }) : "");
  if (openFrom && new Date(openFrom) > new Date()) return t("match.willOpen", { time: formatTime(openFrom) });
  return t("match.closedBrowse");
});

const closedOpenTime = computed(() => {
  const from = windowState.value.openFrom;
  return from ? formatTime(from) : "";
});

const countdown = computed(() => {
  const from = windowState.value.openFrom;
  if (!from || windowState.value.open) return null;
  const start = new Date(from).getTime();
  if (Number.isNaN(start) || start <= nowTick.value) return null;
  let left = Math.floor((start - nowTick.value) / 1000);
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
});

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(value) {
  return formatDateTime(value);
}

async function load(silent) {
  if (!silent) loading.value = true;
  error.value = "";
  try {
    const data = await api.state(studentToken.value);
    bands.value = data.bands || {};
    windowState.value = data.window || windowState.value;
    me.value = data.me || null;
    messages.value = data.messages || [];
    if (studentToken.value && !data.me) setStudentToken("");
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

function onAuthed(token) {
  setStudentToken(token);
  notice.value = "";
  showGate.value = false;
  authPrompt.value = false;
  load();
}

function logout() {
  setStudentToken("");
  me.value = null;
  messages.value = [];
  notice.value = "";
}

function askPick(mentor) {
  notice.value = "";
  error.value = "";
  if (!windowState.value.open) {
    closedPrompt.value = true;
    return;
  }
  if (!me.value) {
    authPrompt.value = true;
    return;
  }
  confirmTarget.value = mentor;
}

function goLogin() {
  authPrompt.value = false;
  showGate.value = true;
  requestAnimationFrame(() => {
    const el = document.getElementById("login-gate");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function confirmPick() {
  const mentor = confirmTarget.value;
  if (!mentor) return;
  confirmTarget.value = null;
  busyId.value = mentor.id;
  error.value = "";
  try {
    const data = await api.pick(studentToken.value, mentor.id);
    bands.value = data.bands || bands.value;
    me.value = data.me || me.value;
    messages.value = data.messages || [];
    notice.value = t("match.picked", { name: mentor.name });
  } catch (err) {
    error.value = te(err.message);
    load();
  } finally {
    busyId.value = "";
  }
}

watch(countdown, (next, prev) => {
  if (!next && prev && !windowState.value.open) load(true);
});

watch(studentToken, (token) => {
  if (token) {
    showGate.value = false;
    authPrompt.value = false;
    load(true);
  }
});

onMounted(() => {
  load();
  tickTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickTimer) window.clearInterval(tickTimer);
});
</script>

<template>
  <SiteHero
    :title="t('match.title')"
    :lede="t('match.lede')"
    :note="windowNote"
  >
    <template #actions>
      <p class="sort-line">{{ t("match.sort") }}</p>
    </template>
  </SiteHero>

  <main class="wrap">
    <p v-if="loading" class="placeholder">{{ t("jobs.loading") }}</p>

    <template v-else>
      <section v-if="countdown" class="countdown" aria-live="polite">
        <p class="countdown-label">{{ t("match.countdown") }}</p>
        <div class="countdown-units">
          <span><strong>{{ countdown.days }}</strong>{{ t("match.d") }}</span>
          <span><strong>{{ pad(countdown.hours) }}</strong>{{ t("match.h") }}</span>
          <span><strong>{{ pad(countdown.minutes) }}</strong>{{ t("match.m") }}</span>
          <span><strong>{{ pad(countdown.seconds) }}</strong>{{ t("match.s") }}</span>
        </div>
        <p class="countdown-when">{{ t("match.openAt", { time: formatTime(windowState.openFrom) }) }}</p>
      </section>

      <section v-if="me" class="mebar">
        <div>
          <p class="who">
            {{ me.name }} · {{ me.studentId }} · {{ t("match.year", { year: me.enrollYear }) }}
            <span v-if="me.navigator" class="nav-tag">{{ t("match.navTag") }}</span>
          </p>
          <p class="pick-state">
            <template v-if="myMentor">
              {{ t("match.current") }}<strong>{{ myMentor.name }}</strong>（{{ myMentor.org }}）
            </template>
            <template v-else>{{ t("match.none") }}</template>
          </p>
        </div>
        <button class="btn ghost" type="button" @click="logout">{{ t("nav.logout") }}</button>
      </section>

      <section v-else class="guest-bar">
        <p>{{ t("match.guest") }}</p>
        <button class="btn ghost" type="button" @click="showGate = !showGate">
          {{ showGate ? t("match.hideLogin") : t("match.showLogin") }}
        </button>
      </section>

      <div v-if="!me && showGate" id="login-gate">
        <LoginView @authed="onAuthed" />
      </div>

      <section v-if="myMentor" class="panel inbox">
        <div class="inbox-head">
          <h2>{{ t("match.notices", { name: myMentor.name }) }}</h2>
          <span v-if="messages.length" class="pill">{{ t("match.nMsg", { n: messages.length }) }}</span>
          <button class="btn ghost tiny" type="button" @click="showMessages = !showMessages">
            {{ showMessages ? t("match.collapse") : t("match.expand") }}
          </button>
        </div>
        <MessageFeed
          v-show="showMessages"
          :messages="messages"
          :token="studentToken"
          :empty-text="t('match.noNotice')"
        />
      </section>

      <p v-if="notice" class="alert ok">{{ notice }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="me && !windowState.open && !countdown" class="alert error">
        {{ t("match.needOpen", { note: windowNote }) }}
      </p>

      <section class="toolbar">
        <label class="search">
          <span class="sr-only">{{ t("match.search") }}</span>
          <input v-model="query" type="search" :placeholder="t('match.searchPh')" />
        </label>
        <p class="count">{{ t("match.count", { n: shown.length }) }}</p>
      </section>

      <div class="directory">
        <template v-for="group in grouped" :key="group.letter">
          <div class="letter">{{ group.letter }}</div>
          <MentorCard
            v-for="mentor in group.items"
            :key="mentor.id"
            :mentor="mentor"
            :band="bands[mentor.id] || {}"
            :mine="!!(me && me.mentorId === mentor.id)"
            :selectable="true"
            :busy="busyId === mentor.id"
            @pick="askPick"
          />
        </template>
        <div v-if="!shown.length" class="empty">{{ t("match.empty") }}</div>
      </div>
    </template>
  </main>

  <div v-if="closedPrompt" class="modal-mask" @click.self="closedPrompt = false">
    <div class="modal">
      <h3>{{ t("match.closedTitle") }}</h3>
      <p>{{ t("match.closedBody", { time: closedOpenTime || t("match.closedSoon") }) }}</p>
      <div class="modal-actions">
        <button class="btn" type="button" @click="closedPrompt = false">{{ t("match.gotIt") }}</button>
      </div>
    </div>
  </div>

  <div v-if="authPrompt" class="modal-mask" @click.self="authPrompt = false">
    <div class="modal">
      <h3>{{ t("match.needAuthTitle") }}</h3>
      <p>{{ t("match.needAuthBody") }}</p>
      <div class="modal-actions">
        <button class="btn ghost" type="button" @click="authPrompt = false">{{ t("match.keepBrowse") }}</button>
        <button class="btn" type="button" @click="goLogin">{{ t("match.goLogin") }}</button>
      </div>
    </div>
  </div>

  <div v-if="confirmTarget" class="modal-mask" @click.self="confirmTarget = null">
    <div class="modal">
      <h3>{{ t("match.confirmTitle") }}</h3>
      <p>
        {{ t("match.confirmBody", { name: confirmTarget.name, org: confirmTarget.org }) }}
      </p>
      <p class="modal-hint">
        {{ t("match.confirmHint") }}
      </p>
      <div class="modal-actions">
        <button class="btn ghost" type="button" @click="confirmTarget = null">{{ t("match.cancel") }}</button>
        <button class="btn" type="button" @click="confirmPick">{{ t("match.confirm") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sort-line {
  margin: 12px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.placeholder {
  text-align: center;
  color: var(--muted);
  padding: 56px 16px;
}

.countdown {
  margin-bottom: 18px;
  padding: 22px 20px 20px;
  background: var(--navy);
  color: #fff;
  border-radius: 8px;
  text-align: center;
  border-bottom: 2px solid var(--gold);
}

.countdown-label {
  margin: 0 0 10px;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--gold-soft);
}

.countdown-units {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

.countdown-units strong {
  display: block;
  font-size: 32px;
  line-height: 1.1;
  font-weight: 650;
}

.countdown-units span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.countdown-when {
  margin: 12px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.guest-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.guest-bar p {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

.inbox { margin-bottom: 14px; }

.inbox-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.inbox-head h2 {
  margin: 0;
  font-size: 17px;
}

.pill {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 10px;
  background: rgba(75, 29, 110, 0.08);
  color: var(--purple);
}

.inbox-head .tiny {
  margin-left: auto;
  padding: 3px 12px;
  font-size: 12px;
}

.mebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.who {
  margin: 0;
  font-weight: 650;
}

.nav-tag {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  padding: 2px 10px;
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
}

.pick-state {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.search {
  flex: 1;
  max-width: 480px;
}

.search input {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 10px;
  padding: 12px 18px;
  font: inherit;
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search input:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 4px rgba(31, 33, 82, 0.12);
}

.count {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  white-space: nowrap;
}

.directory {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
}

.letter {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 18px 0 2px;
  color: var(--purple);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.letter::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(31, 33, 82, 0.28), transparent);
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--muted);
  padding: 56px 16px;
  background: var(--card);
  border: 1px dashed var(--line);
  border-radius: 8px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(27, 19, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 40;
}

.modal {
  background: var(--card);
  border-radius: 20px;
  padding: 26px 24px 22px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 28px 60px rgba(36, 16, 51, 0.3);
}

.modal h3 { margin: 0 0 12px; font-size: 20px; }
.modal p { margin: 0 0 10px; }
.modal-hint { font-size: 13px; color: var(--muted); }

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 980px) {
  .directory { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .toolbar, .mebar, .guest-bar { flex-direction: column; align-items: stretch; }
  .search { max-width: none; }
  .directory { grid-template-columns: 1fr; }
}
</style>
