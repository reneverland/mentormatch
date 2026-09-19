<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MessageFeed from "../components/MessageFeed.vue";
import mentors from "../data/mentors";
import api from "../api";
import { mentorToken, setMentorToken } from "../session";

const MAX_IMAGES = 4;

const loading = ref(false);
const error = ref("");
const notice = ref("");
const mentor = ref(null);
const students = ref([]);
const messages = ref([]);
const remaining = ref(0);

const gate = reactive({ mentorId: "", password: "" });
const pwd = reactive({ current: "", next: "", again: "" });
const draft = reactive({ text: "", images: [] });

const navigators = computed(() => students.value.filter((s) => s.navigator));

// 登录下拉直接用打包进来的导师名单，省一次请求，也带上单位便于重名区分。
const roster = computed(() =>
  mentors.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
);

async function loadGroup() {
  if (!mentorToken.value) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await api.mentorGroup(mentorToken.value);
    mentor.value = data.mentor;
    students.value = data.students || [];
    messages.value = data.messages || [];
    remaining.value = data.remaining || 0;
  } catch (err) {
    error.value = err.message;
    if (/登录|失效|401/.test(err.message)) logout();
  } finally {
    loading.value = false;
  }
}

async function login() {
  error.value = "";
  loading.value = true;
  try {
    const data = await api.mentorLogin(gate.mentorId, gate.password);
    setMentorToken(data.token);
    gate.password = "";
    await loadGroup();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function logout() {
  setMentorToken("");
  mentor.value = null;
  students.value = [];
  messages.value = [];
  notice.value = "";
}

async function changePassword() {
  error.value = "";
  notice.value = "";
  if (pwd.next !== pwd.again) {
    error.value = "两次输入的新密码不一致。";
    return;
  }
  loading.value = true;
  try {
    const data = await api.mentorPassword(mentorToken.value, pwd.current, pwd.next);
    setMentorToken(data.token);
    pwd.current = "";
    pwd.next = "";
    pwd.again = "";
    notice.value = "密码已更新。";
    await loadGroup();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function onImages(event) {
  const files = Array.from(event.target.files || []);
  error.value = "";
  if (draft.images.length + files.length > MAX_IMAGES) {
    error.value = "一条消息最多 " + MAX_IMAGES + " 张图片。";
    event.target.value = "";
    return;
  }
  files.forEach((file) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      error.value = "图片仅支持 jpg / png / webp。";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      error.value = "单张图片请控制在 2MB 以内。";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      draft.images.push({
        filename: file.name,
        dataBase64: String(reader.result).split(",")[1] || "",
        preview: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
}

function dropImage(index) {
  draft.images.splice(index, 1);
}

async function broadcast() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    const payload = draft.images.map((img) => ({
      filename: img.filename,
      dataBase64: img.dataBase64,
    }));
    const data = await api.mentorBroadcast(mentorToken.value, draft.text.trim(), payload);
    messages.value = data.messages || [];
    draft.text = "";
    draft.images = [];
    notice.value = "已发送给本组 " + students.value.length + " 位学生。";
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function removeMessage(msg) {
  if (!window.confirm("删除这条通知？学生将不再看到。")) return;
  error.value = "";
  try {
    const data = await api.mentorDeleteMessage(mentorToken.value, msg.id);
    messages.value = data.messages || [];
    notice.value = "已删除。";
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadGroup);
</script>

<template>
  <SiteHero
    title="校外导师工作台"
    lede="2026-2027 信息管理与商业分析硕士项目"
    note="查看本组学生与简历、向本组群发通知、修改登录密码"
  />

  <nav class="entries">
    <a href="/">平台首页</a>
    <router-link to="/">返回学生端</router-link>
    <a href="/guide">在读生指引</a>
  </nav>

  <main class="wrap">
    <section v-if="!mentor" class="gate">
      <p v-if="error" class="alert error">{{ error }}</p>
      <label class="field">
        <span>选择姓名</span>
        <select v-model="gate.mentorId">
          <option value="">请选择</option>
          <option v-for="m in roster" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>密码</span>
        <input v-model="gate.password" type="password" @keyup.enter="login" />
      </label>
      <button
        class="btn"
        type="button"
        :disabled="!gate.mentorId || !gate.password || loading"
        @click="login"
      >进入工作台</button>
      <p class="hint pad">初始密码由项目组下发，登录后请在下方修改。</p>
    </section>

    <template v-else>
      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="notice" class="alert ok">{{ notice }}</p>
      <p v-if="mentor.usingDefaultPassword" class="alert error">
        你还在使用初始密码，请尽快在「修改密码」里更换。
      </p>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ mentor.name }} · 本组学生</h2>
          <div class="tools">
            <span class="stat">
              已匹配 {{ students.length }} / {{ mentor.capacity }} 人 · 剩余 {{ remaining }} 个名额
              <template v-if="navigators.length"> · 领航员 {{ navigators.length }} 人</template>
            </span>
            <button class="btn ghost" type="button" @click="loadGroup">刷新</button>
            <button class="btn ghost" type="button" @click="logout">退出</button>
          </div>
        </div>

        <table v-if="students.length" class="board">
          <thead>
            <tr>
              <th>姓名</th>
              <th>学号</th>
              <th>入学年份</th>
              <th>邮箱</th>
              <th>领航员</th>
              <th>简历</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.studentId">
              <td class="name">{{ s.name }}</td>
              <td>{{ s.studentId }}</td>
              <td>{{ s.enrollYear }}</td>
              <td>{{ s.email }}</td>
              <td>{{ s.navigator ? "愿意" : "—" }}</td>
              <td>
                <a
                  v-if="s.resume"
                  :href="api.mentorResumeUrl(mentorToken, s.studentId)"
                  target="_blank"
                  rel="noopener"
                >查看 PDF</a>
                <span v-else class="muted">未上传</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">还没有学生选择你，开放期结束前名单会持续变化。</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>给本组群发通知</h2>
          <span class="stat">仅当前在你组里的 {{ students.length }} 位学生可见</span>
        </div>

        <label class="field">
          <span>通知内容</span>
          <textarea
            v-model="draft.text"
            rows="4"
            maxlength="2000"
            placeholder="例如：本周六 20:00 线上见面会，腾讯会议号…"
          ></textarea>
        </label>

        <label class="field">
          <span>附图（jpg / png / webp，单张 2MB 内，最多 {{ MAX_IMAGES }} 张）</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onImages" />
        </label>

        <div v-if="draft.images.length" class="previews">
          <div v-for="(img, i) in draft.images" :key="img.filename + i" class="preview">
            <img :src="img.preview" :alt="img.filename" />
            <button type="button" @click="dropImage(i)">移除</button>
          </div>
        </div>

        <button
          class="btn"
          type="button"
          :disabled="loading || (!draft.text.trim() && !draft.images.length)"
          @click="broadcast"
        >发送通知</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>已发通知</h2>
          <span class="stat">共 {{ messages.length }} 条</span>
        </div>
        <MessageFeed
          :messages="messages"
          :token="mentorToken"
          empty-text="还没有发过通知。"
          deletable
          @remove="removeMessage"
        />
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>修改密码</h2>
        </div>
        <div class="grid">
          <label class="field">
            <span>当前密码</span>
            <input v-model="pwd.current" type="password" autocomplete="current-password" />
          </label>
          <label class="field">
            <span>新密码（至少 8 位）</span>
            <input v-model="pwd.next" type="password" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>再输一次新密码</span>
            <input v-model="pwd.again" type="password" autocomplete="new-password" />
          </label>
        </div>
        <button
          class="btn"
          type="button"
          :disabled="loading || !pwd.current || pwd.next.length < 8"
          @click="changePassword"
        >保存新密码</button>
      </section>
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

.hint.pad { margin: 14px 0 0; }

.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stat { font-size: 13px; color: var(--muted); }

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
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
.board a { color: var(--purple); }

textarea {
  width: 100%;
  font: inherit;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #ddd2c4;
  background: #fff;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: var(--purple);
}

input[type="file"] {
  width: 100%;
  font: inherit;
  font-size: 13px;
}

.previews {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.preview {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.preview img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--line);
}

.preview button {
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: var(--bad);
  cursor: pointer;
}

@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
