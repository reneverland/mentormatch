<script setup>
import { computed, onMounted, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MentorCard from "../components/MentorCard.vue";
import LoginView from "./LoginView.vue";
import mentors from "../data/mentors";
import api from "../api";
import { studentToken, setStudentToken } from "../session";

const loading = ref(true);
const error = ref("");
const notice = ref("");
const busyId = ref("");
const query = ref("");
const counts = ref({});
const me = ref(null);
const windowState = ref({ open: false, openFrom: "", openTo: "" });
const confirmTarget = ref(null);

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
  if (open) return "选择通道开放中" + (openTo ? "，截止 " + formatTime(openTo) : "");
  if (openFrom && new Date(openFrom) > new Date()) return "选择通道将于 " + formatTime(openFrom) + " 开放";
  return "选择通道当前关闭，可先浏览导师与剩余名额";
});

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false }).replace(/:\d{2}$/, "");
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.state(studentToken.value);
    counts.value = data.counts || {};
    windowState.value = data.window || windowState.value;
    me.value = data.me || null;
    if (studentToken.value && !data.me) setStudentToken("");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function onAuthed(token) {
  setStudentToken(token);
  notice.value = "";
  load();
}

function logout() {
  setStudentToken("");
  me.value = null;
  notice.value = "";
}

function askPick(mentor) {
  notice.value = "";
  error.value = "";
  confirmTarget.value = mentor;
}

async function confirmPick() {
  const mentor = confirmTarget.value;
  if (!mentor) return;
  confirmTarget.value = null;
  busyId.value = mentor.id;
  error.value = "";
  try {
    const data = await api.pick(studentToken.value, mentor.id);
    counts.value = data.counts || counts.value;
    me.value = data.me || me.value;
    notice.value = "已选择导师：" + mentor.name;
  } catch (err) {
    error.value = err.message;
    load();
  } finally {
    busyId.value = "";
  }
}

onMounted(load);
</script>

<template>
  <SiteHero
    title="2026-2027 校外导师匹配"
    lede="信息管理与商业分析硕士项目"
    :note="windowNote"
  />

  <main class="wrap">
    <p v-if="loading" class="placeholder">加载中…</p>

    <template v-else>
      <LoginView v-if="!me" @authed="onAuthed" />

      <template v-else>
        <section class="mebar">
          <div>
            <p class="who">
              {{ me.name }} · {{ me.studentId }} · {{ me.enrollYear }} 级
              <span v-if="me.navigator" class="nav-tag">愿任领航员</span>
            </p>
            <p class="pick-state">
              <template v-if="myMentor">
                当前选择：<strong>{{ myMentor.name }}</strong>（{{ myMentor.org }}）
              </template>
              <template v-else>尚未选择导师</template>
            </p>
          </div>
          <button class="btn ghost" type="button" @click="logout">退出</button>
        </section>

        <p v-if="notice" class="alert ok">{{ notice }}</p>
        <p v-if="error" class="alert error">{{ error }}</p>
        <p v-if="!windowState.open" class="alert error">
          {{ windowNote }}。开放后可在本页选择或更换导师。
        </p>

        <section class="toolbar">
          <label class="search">
            <span class="sr-only">搜索导师</span>
            <input v-model="query" type="search" placeholder="搜索姓名、单位、职位、行业、擅长方向…" />
          </label>
          <p class="count">共 {{ shown.length }} 位导师</p>
        </section>

        <div class="directory">
          <template v-for="group in grouped" :key="group.letter">
            <div class="letter">{{ group.letter }}</div>
            <MentorCard
              v-for="mentor in group.items"
              :key="mentor.id"
              :mentor="mentor"
              :taken="counts[mentor.id] || 0"
              :mine="me.mentorId === mentor.id"
              :selectable="windowState.open"
              :busy="busyId === mentor.id"
              @pick="askPick"
            />
          </template>
          <div v-if="!shown.length" class="empty">没有符合条件的导师。</div>
        </div>
      </template>
    </template>
  </main>

  <div v-if="confirmTarget" class="modal-mask" @click.self="confirmTarget = null">
    <div class="modal">
      <h3>确认选择</h3>
      <p>
        将你的校外导师设为 <strong>{{ confirmTarget.name }}</strong>（{{ confirmTarget.org }}）。
      </p>
      <p class="modal-hint">
        每人只能选 1 位导师，先到先得。开放时间内可以改选到仍有名额的导师。
      </p>
      <div class="modal-actions">
        <button class="btn ghost" type="button" @click="confirmTarget = null">取消</button>
        <button class="btn" type="button" @click="confirmPick">确认选择</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  text-align: center;
  color: var(--muted);
  padding: 56px 16px;
}

.mebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
  background: rgba(255, 252, 248, 0.9);
  border: 1px solid var(--line);
  border-radius: 18px;
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
  background: rgba(196, 163, 90, 0.18);
  color: #8d6b2c;
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
  background: rgba(255, 252, 248, 0.86);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(36, 16, 51, 0.04);
}

.search {
  flex: 1;
  max-width: 480px;
}

.search input {
  width: 100%;
  border: 1px solid #ddd2c4;
  background: #fff;
  border-radius: 999px;
  padding: 12px 18px;
  font: inherit;
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 4px rgba(196, 163, 90, 0.16);
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
  background: linear-gradient(90deg, rgba(196, 163, 90, 0.7), transparent);
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--muted);
  padding: 56px 16px;
  background: var(--card);
  border: 1px dashed var(--line);
  border-radius: 18px;
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
  .toolbar, .mebar { flex-direction: column; align-items: stretch; }
  .search { max-width: none; }
  .directory { grid-template-columns: 1fr; }
}
</style>
