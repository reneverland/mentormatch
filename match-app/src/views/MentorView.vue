<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MessageFeed from "../components/MessageFeed.vue";
import mentors from "../data/mentors";
import api from "../api";
import { mentorToken, setMentorToken } from "../session";
import { t, te } from "../i18n";

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
    error.value = te(err.message);
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
    error.value = te(err.message);
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
    error.value = t("mentor.pwdMismatch");
    return;
  }
  loading.value = true;
  try {
    const data = await api.mentorPassword(mentorToken.value, pwd.current, pwd.next);
    setMentorToken(data.token);
    pwd.current = "";
    pwd.next = "";
    pwd.again = "";
    notice.value = t("mentor.pwdOk");
    await loadGroup();
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

function onImages(event) {
  const files = Array.from(event.target.files || []);
  error.value = "";
  if (draft.images.length + files.length > MAX_IMAGES) {
    error.value = t("mentor.imgMax", { n: MAX_IMAGES });
    event.target.value = "";
    return;
  }
  files.forEach((file) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      error.value = t("mentor.imgType");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
    error.value = t("mentor.imgSize");
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
    notice.value = t("mentor.sentOk", { n: students.value.length });
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

async function removeMessage(msg) {
  if (!window.confirm(t("mentor.delConfirm"))) return;
  error.value = "";
  try {
    const data = await api.mentorDeleteMessage(mentorToken.value, msg.id);
    messages.value = data.messages || [];
    notice.value = t("mentor.deleted");
  } catch (err) {
    error.value = te(err.message);
  }
}

onMounted(loadGroup);
</script>

<template>
  <SiteHero
    :title="t('mentor.title')"
    :lede="t('mentor.lede')"
    :note="t('mentor.note')"
  />

  <main class="wrap">
    <section v-if="!mentor" class="gate">
      <p v-if="error" class="alert error">{{ error }}</p>
      <label class="field">
        <span>{{ t("mentor.pickName") }}</span>
        <select v-model="gate.mentorId">
          <option value="">{{ t("login.choose") }}</option>
          <option v-for="m in roster" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>{{ t("mentor.password") }}</span>
        <input v-model="gate.password" type="password" @keyup.enter="login" />
      </label>
      <button
        class="btn"
        type="button"
        :disabled="!gate.mentorId || !gate.password || loading"
        @click="login"
      >{{ t("mentor.enter") }}</button>
      <p class="hint pad">{{ t("mentor.gateHint") }}</p>
    </section>

    <template v-else>
      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="notice" class="alert ok">{{ notice }}</p>
      <p v-if="mentor.usingDefaultPassword" class="alert error">
        {{ t("mentor.defaultPwd") }}
      </p>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ t("mentor.group", { name: mentor.name }) }}</h2>
          <div class="tools">
            <span class="stat">
              {{ t("mentor.stat", { n: students.length, cap: mentor.capacity, left: remaining }) }}
              <template v-if="navigators.length">{{ t("mentor.navs", { n: navigators.length }) }}</template>
            </span>
            <button class="btn ghost" type="button" @click="loadGroup">{{ t("mentor.refresh") }}</button>
            <button class="btn ghost" type="button" @click="logout">{{ t("nav.logout") }}</button>
          </div>
        </div>

        <table v-if="students.length" class="board">
          <thead>
            <tr>
              <th>{{ t("mentor.name") }}</th>
              <th>{{ t("mentor.sid") }}</th>
              <th>{{ t("mentor.year") }}</th>
              <th>{{ t("mentor.email") }}</th>
              <th>{{ t("mentor.navigator") }}</th>
              <th>{{ t("mentor.resume") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.studentId">
              <td class="name">{{ s.name }}</td>
              <td>{{ s.studentId }}</td>
              <td>{{ s.enrollYear }}</td>
              <td>{{ s.email }}</td>
              <td>{{ s.navigator ? t("mentor.willing") : "—" }}</td>
              <td>
                <a
                  v-if="s.resume"
                  :href="api.mentorResumeUrl(mentorToken, s.studentId)"
                  target="_blank"
                  rel="noopener"
                >{{ t("mentor.viewPdf") }}</a>
                <span v-else class="muted">{{ t("mentor.noResume") }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">{{ t("mentor.noStudents") }}</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ t("mentor.broadcast") }}</h2>
          <span class="stat">{{ t("mentor.broadcastStat", { n: students.length }) }}</span>
        </div>

        <label class="field">
          <span>{{ t("mentor.body") }}</span>
          <textarea
            v-model="draft.text"
            rows="4"
            maxlength="2000"
            :placeholder="t('mentor.bodyPh')"
          ></textarea>
        </label>

        <label class="field">
          <span>{{ t("mentor.images", { n: MAX_IMAGES }) }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onImages" />
        </label>

        <div v-if="draft.images.length" class="previews">
          <div v-for="(img, i) in draft.images" :key="img.filename + i" class="preview">
            <img :src="img.preview" :alt="img.filename" />
            <button type="button" @click="dropImage(i)">{{ t("mentor.remove") }}</button>
          </div>
        </div>

        <button
          class="btn"
          type="button"
          :disabled="loading || (!draft.text.trim() && !draft.images.length)"
          @click="broadcast"
        >{{ t("mentor.send") }}</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ t("mentor.sent") }}</h2>
          <span class="stat">{{ t("mentor.nItems", { n: messages.length }) }}</span>
        </div>
        <MessageFeed
          :messages="messages"
          :token="mentorToken"
          :empty-text="t('mentor.noSent')"
          deletable
          @remove="removeMessage"
        />
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ t("mentor.changePwd") }}</h2>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("mentor.curPwd") }}</span>
            <input v-model="pwd.current" type="password" autocomplete="current-password" />
          </label>
          <label class="field">
            <span>{{ t("mentor.newPwd") }}</span>
            <input v-model="pwd.next" type="password" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>{{ t("mentor.againPwd") }}</span>
            <input v-model="pwd.again" type="password" autocomplete="new-password" />
          </label>
        </div>
        <button
          class="btn"
          type="button"
          :disabled="loading || !pwd.current || pwd.next.length < 8"
          @click="changePassword"
        >{{ t("mentor.savePwd") }}</button>
      </section>
    </template>
  </main>
</template>

<style scoped>
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
  border-radius: 10px;
  border: 1px solid var(--line);
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
