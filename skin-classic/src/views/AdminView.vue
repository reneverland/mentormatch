<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MessageFeed from "../components/MessageFeed.vue";
import mentors from "../data/mentors";
import api from "../api";
import { adminToken, setAdminToken } from "../session";

const loading = ref(false);
const error = ref("");
const notice = ref("");
const password = ref("");
const students = ref([]);
const counts = ref({});
const mentorAccounts = ref([]);
const messages = ref([]);
const messageMentor = ref("");

const config = reactive({
  inviteCode: "",
  openFrom: "",
  openTo: "",
  newAdminPassword: "",
});

const blankStudent = () => ({
  studentId: "",
  name: "",
  enrollYear: String(new Date().getFullYear()),
  email: "",
  navigator: false,
  mentorId: "",
  resumeFilename: "",
  resumeBase64: "",
  isEdit: false,
});

const editor = reactive(blankStudent());

const mentorById = computed(() => {
  const map = {};
  mentors.forEach((m) => { map[m.id] = m; });
  return map;
});

const rows = computed(() =>
  mentors
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    .map((m) => {
      const group = students.value.filter((s) => s.mentorId === m.id);
      return {
        ...m,
        taken: counts.value[m.id] || 0,
        students: group,
        resumeCount: group.filter((s) => s.resume).length,
      };
    })
);

const picked = computed(() => students.value.filter((s) => s.mentorId).length);
const resumeTotal = computed(() => students.value.filter((s) => s.resume).length);

const shownMessages = computed(() => {
  if (!messageMentor.value) return messages.value;
  return messages.value.filter((m) => m.mentorId === messageMentor.value);
});

const messageMentors = computed(() => {
  const seen = {};
  messages.value.forEach((m) => {
    if (m.mentorId && !seen[m.mentorId]) seen[m.mentorId] = m.mentorName || m.mentorId;
  });
  return Object.keys(seen)
    .map((id) => ({ id, name: seen[id] }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
});

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
    mentorAccounts.value = data.mentorAccounts || [];
    messages.value = data.messages || [];
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
  mentorAccounts.value = [];
  messages.value = [];
}

/* ---------- 学生名单维护 ---------- */

const sortedMentors = computed(() =>
  mentors.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
);

const editorTitle = computed(() => (editor.isEdit ? "编辑学生" : "新增学生"));

function resetEditor() {
  Object.assign(editor, blankStudent());
}

function startEdit(student) {
  Object.assign(editor, blankStudent(), {
    studentId: student.studentId,
    name: student.name,
    enrollYear: student.enrollYear,
    email: student.email,
    navigator: Boolean(student.navigator),
    mentorId: student.mentorId || "",
    isEdit: true,
  });
  notice.value = "";
  error.value = "";
}

function onEditorResume(event) {
  const file = event.target.files && event.target.files[0];
  error.value = "";
  if (!file) {
    editor.resumeFilename = "";
    editor.resumeBase64 = "";
    return;
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    error.value = "简历请上传 PDF 格式。";
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    editor.resumeFilename = file.name;
    editor.resumeBase64 = String(reader.result).split(",")[1] || "";
  };
  reader.readAsDataURL(file);
}

async function saveStudent() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    await api.adminSaveStudent(adminToken.value, {
      studentId: editor.studentId.trim(),
      name: editor.name.trim(),
      enrollYear: String(editor.enrollYear).trim(),
      email: editor.email.trim(),
      navigator: editor.navigator,
      mentorId: editor.mentorId,
      resumeFilename: editor.resumeFilename,
      resumeBase64: editor.resumeBase64,
    });
    notice.value = (editor.isEdit ? "已更新 " : "已新增 ") + editor.name;
    resetEditor();
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function assign(student, mentorId) {
  error.value = "";
  notice.value = "";
  try {
    await api.adminAssign(adminToken.value, student.studentId, mentorId);
    notice.value = mentorId
      ? student.name + " 已调整到 " + (mentorById.value[mentorId] || {}).name
      : student.name + " 已移出小组";
    await load();
  } catch (err) {
    error.value = err.message;
    await load();
  }
}

async function removeStudent(student) {
  if (!window.confirm("删除 " + student.name + "（" + student.studentId + "）的档案、选择与简历？")) {
    return;
  }
  error.value = "";
  notice.value = "";
  try {
    await api.adminDeleteStudent(adminToken.value, student.studentId);
    notice.value = "已删除 " + student.name;
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

async function removeAdminMessage(msg) {
  if (!window.confirm("下架这条群发？学生端将不再显示。")) return;
  error.value = "";
  notice.value = "";
  try {
    await api.adminDeleteMessage(adminToken.value, msg.id);
    notice.value = "已下架 " + (msg.mentorName || "") + " 的一条群发。";
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

async function resetMentorPassword(row) {
  if (!window.confirm("把 " + row.name + " 的密码重置为初始密码？")) return;
  error.value = "";
  notice.value = "";
  try {
    const data = await api.adminResetMentorPassword(adminToken.value, row.id);
    notice.value = row.name + " 的密码已重置为 " + data.password;
    await load();
  } catch (err) {
    error.value = err.message;
  }
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
            <span class="stat">注册 {{ students.length }} 人 · 已选 {{ picked }} 人 · 简历 {{ resumeTotal }} 份</span>
            <a class="btn ghost" :href="api.adminExportUrl(adminToken)">导出 CSV</a>
            <a class="btn ghost" :href="api.adminResumesZipUrl(adminToken)">批量下载全部简历</a>
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
              <th>本组简历</th>
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
              <td>
                <a
                  v-if="row.resumeCount"
                  :href="api.adminResumesZipUrl(adminToken, row.id)"
                >下载 {{ row.resumeCount }} 份</a>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>学生名单</h2>
          <span class="stat">调组与移出不受开放时间限制，但仍会检查导师名额上限</span>
        </div>

        <table class="board">
          <thead>
            <tr>
              <th>姓名</th>
              <th>学号</th>
              <th>年份</th>
              <th>邮箱</th>
              <th>所在小组</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.studentId">
              <td class="name">
                {{ s.name }}
                <span v-if="s.navigator" class="nav-tag">领航员</span>
              </td>
              <td>{{ s.studentId }}</td>
              <td>{{ s.enrollYear }}</td>
              <td>{{ s.email }}</td>
              <td>
                <select
                  class="inline-select"
                  :value="s.mentorId || ''"
                  @change="assign(s, $event.target.value)"
                >
                  <option value="">未分组</option>
                  <option v-for="m in sortedMentors" :key="m.id" :value="m.id">
                    {{ m.name }}（{{ counts[m.id] || 0 }}/{{ m.capacity }}）
                  </option>
                </select>
              </td>
              <td class="ops">
                <a
                  v-if="s.resume"
                  :href="api.adminResumeUrl(adminToken, s.studentId)"
                  target="_blank"
                  rel="noopener"
                >简历</a>
                <span v-else class="muted">无简历</span>
                <button type="button" @click="startEdit(s)">编辑</button>
                <button type="button" class="danger" @click="removeStudent(s)">删除</button>
              </td>
            </tr>
            <tr v-if="!students.length">
              <td colspan="6" class="muted">还没有学生注册。</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ editorTitle }}</h2>
          <button v-if="editor.isEdit" class="btn ghost" type="button" @click="resetEditor">
            取消编辑
          </button>
        </div>
        <div class="grid">
          <label class="field">
            <span>学号 *</span>
            <input v-model="editor.studentId" type="text" :disabled="editor.isEdit" />
          </label>
          <label class="field">
            <span>姓名 *</span>
            <input v-model="editor.name" type="text" />
          </label>
          <label class="field">
            <span>入学年份 *</span>
            <input v-model="editor.enrollYear" type="text" placeholder="例如 2026" />
          </label>
          <label class="field">
            <span>邮箱 *</span>
            <input v-model="editor.email" type="email" />
          </label>
          <label class="field">
            <span>愿任领航员</span>
            <select v-model="editor.navigator">
              <option :value="false">否</option>
              <option :value="true">是</option>
            </select>
          </label>
          <label class="field">
            <span>分配导师</span>
            <select v-model="editor.mentorId">
              <option value="">暂不分组</option>
              <option v-for="m in sortedMentors" :key="m.id" :value="m.id">
                {{ m.name }}（{{ counts[m.id] || 0 }}/{{ m.capacity }}）
              </option>
            </select>
          </label>
          <label class="field">
            <span>简历 PDF{{ editor.isEdit ? "（留空表示不替换）" : " *" }}</span>
            <input type="file" accept="application/pdf" @change="onEditorResume" />
          </label>
        </div>
        <button
          class="btn"
          type="button"
          :disabled="loading || !editor.studentId || !editor.name || !editor.email"
          @click="saveStudent"
        >{{ editor.isEdit ? "保存修改" : "新增学生" }}</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>导师账号</h2>
          <span class="stat">共 {{ mentorAccounts.length }} 个账号 · 入口 /match/mentor</span>
        </div>
        <table class="board">
          <thead>
            <tr>
              <th>导师</th>
              <th>密码状态</th>
              <th>最近变更</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mentorAccounts" :key="row.id">
              <td class="name">{{ row.name }}</td>
              <td :class="{ full: row.usingDefaultPassword }">
                {{ row.usingDefaultPassword ? "仍是初始密码" : "已自行修改" }}
              </td>
              <td class="muted">{{ row.updatedAt ? row.updatedAt.slice(0, 16).replace("T", " ") : "—" }}</td>
              <td class="ops">
                <button type="button" @click="resetMentorPassword(row)">重置密码</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>群发信息监管</h2>
          <div class="tools">
            <span class="stat">共 {{ messages.length }} 条，可按组查看或下架</span>
            <select v-model="messageMentor" class="inline-select">
              <option value="">全部导师</option>
              <option v-for="m in messageMentors" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
        </div>
        <MessageFeed
          :messages="shownMessages"
          :token="adminToken"
          empty-text="还没有导师发过组内通知。"
          deletable
          @remove="removeAdminMessage"
        />
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

.inline-select {
  font: inherit;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 10px;
  border: 1px solid #ddd2c4;
  background: #fff;
  max-width: 200px;
}

.ops {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ops a { margin: 0; }

.ops button {
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: var(--purple);
  cursor: pointer;
  padding: 0;
}

.ops button.danger { color: var(--bad); }

.grid input[type="file"] {
  width: 100%;
  font: inherit;
  font-size: 13px;
}

@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
