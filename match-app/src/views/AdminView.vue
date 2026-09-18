<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import mentors from "../data/mentors";
import api from "../api";
import { adminToken, setAdminToken } from "../session";

const loading = ref(false);
const error = ref("");
const notice = ref("");
const password = ref("");
const students = ref([]);
const counts = ref({});

const config = reactive({
  inviteCode: "",
  openFrom: "",
  openTo: "",
  newAdminPassword: "",
});

const mentorById = computed(() => {
  const map = {};
  mentors.forEach((m) => { map[m.id] = m; });
  return map;
});

const rows = computed(() =>
  mentors
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    .map((m) => ({
      ...m,
      taken: counts.value[m.id] || 0,
      students: students.value.filter((s) => s.mentorId === m.id),
    }))
);

const picked = computed(() => students.value.filter((s) => s.mentorId).length);

async function login() {
  error.value = "";
  loading.value = true;
  try {
    const data = await api.adminLogin(password.value);
    setAdminToken(data.token);
    password.value = "";
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function load() {
  if (!adminToken.value) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await api.adminData(adminToken.value);
    students.value = data.students || [];
    counts.value = data.counts || {};
    config.inviteCode = data.config.inviteCode || "";
    config.openFrom = data.config.openFrom || "";
    config.openTo = data.config.openTo || "";
  } catch (err) {
    error.value = err.message;
    if (/登录|令牌|401/.test(err.message)) setAdminToken("");
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    await api.adminSaveConfig(adminToken.value, {
      inviteCode: config.inviteCode.trim(),
      openFrom: config.openFrom,
      openTo: config.openTo,
      newAdminPassword: config.newAdminPassword.trim() || undefined,
    });
    config.newAdminPassword = "";
    notice.value = "已保存。";
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function logout() {
  setAdminToken("");
  students.value = [];
  counts.value = {};
}

onMounted(load);
</script>

<template>
  <SiteHero
    title="校外导师匹配 · 管理端"
    lede="开放时间、邀请码、选择名单与简历"
  />

  <main class="wrap">
    <section v-if="!adminToken" class="gate">
      <p v-if="error" class="alert error">{{ error }}</p>
      <label class="field">
        <span>管理员密码</span>
        <input v-model="password" type="password" @keyup.enter="login" />
      </label>
      <button class="btn" type="button" :disabled="!password || loading" @click="login">
        进入管理端
      </button>
    </section>

    <template v-else>
      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="notice" class="alert ok">{{ notice }}</p>

      <section class="panel">
        <div class="panel-head">
          <h2>开放设置</h2>
          <button class="btn ghost" type="button" @click="logout">退出</button>
        </div>
        <div class="grid">
          <label class="field">
            <span>验证邀请码</span>
            <input v-model="config.inviteCode" type="text" />
          </label>
          <label class="field">
            <span>开放开始时间（留空表示不限制）</span>
            <input v-model="config.openFrom" type="datetime-local" />
          </label>
          <label class="field">
            <span>开放结束时间（留空表示不限制）</span>
            <input v-model="config.openTo" type="datetime-local" />
          </label>
          <label class="field">
            <span>修改管理员密码（留空则不改）</span>
            <input v-model="config.newAdminPassword" type="password" autocomplete="new-password" />
          </label>
        </div>
        <p class="hint">
          两个时间都留空时，选择通道视为关闭。要立即开放，把开始时间设为过去时刻。
        </p>
        <button class="btn" type="button" :disabled="loading" @click="saveConfig">保存设置</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>选择情况</h2>
          <div class="tools">
            <span class="stat">注册 {{ students.length }} 人 · 已选 {{ picked }} 人</span>
            <a class="btn ghost" :href="api.adminExportUrl(adminToken)">导出 CSV</a>
            <button class="btn ghost" type="button" @click="load">刷新</button>
          </div>
        </div>

        <table class="board">
          <thead>
            <tr>
              <th>导师</th>
              <th>单位 / 职位</th>
              <th>名额</th>
              <th>已选学生</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="name">{{ row.name }}</td>
              <td>
                {{ row.org }}
                <div class="muted">{{ row.title }}</div>
              </td>
              <td :class="{ full: row.taken >= row.capacity }">
                {{ row.taken }} / {{ row.capacity }}
              </td>
              <td>
                <span v-if="!row.students.length" class="muted">—</span>
                <ul v-else class="stu">
                  <li v-for="s in row.students" :key="s.studentId">
                    {{ s.name }}（{{ s.studentId }}，{{ s.enrollYear }} 级）
                    <span v-if="s.navigator" class="nav-tag">领航员</span>
                    <a
                      v-if="s.resume"
                      :href="api.adminResumeUrl(adminToken, s.studentId)"
                      target="_blank"
                      rel="noopener"
                    >简历</a>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>未选导师的学生</h2>
        </div>
        <ul class="stu plain">
          <li v-for="s in students.filter((x) => !x.mentorId)" :key="s.studentId">
            {{ s.name }}（{{ s.studentId }}，{{ s.enrollYear }} 级，{{ s.email }}）
          </li>
          <li v-if="students.every((x) => x.mentorId)" class="muted">全部学生均已选择。</li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.gate {
  max-width: 420px;
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 26px 24px;
  box-shadow: var(--shadow);
}

.gate .btn { width: 100%; }

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 20px 22px 22px;
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.panel-head h2 { margin: 0; font-size: 19px; }

.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tools .btn { text-decoration: none; }

.stat { font-size: 13px; color: var(--muted); }

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.hint {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--muted);
}

.board {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.board th,
.board td {
  text-align: left;
  vertical-align: top;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

.board thead th {
  background: rgba(75, 29, 110, 0.06);
  color: var(--purple);
  font-weight: 650;
  white-space: nowrap;
}

.board .name { font-weight: 650; white-space: nowrap; }
.board .full { color: var(--bad); font-weight: 650; }

.muted { color: var(--muted); font-size: 13px; }

.stu {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.stu.plain li { padding: 4px 0; }

.stu a {
  margin-left: 8px;
  color: var(--purple);
  font-size: 12px;
}

.nav-tag {
  margin-left: 6px;
  font-size: 11px;
  border-radius: 999px;
  padding: 1px 8px;
  background: rgba(196, 163, 90, 0.18);
  color: #8d6b2c;
}

@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
