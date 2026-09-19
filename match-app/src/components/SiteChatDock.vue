<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import api from "../api";
import ImbaAvatar from "./ImbaAvatar.vue";
import { studentToken, setStudentToken } from "../session";
import { t, te } from "../i18n";

const dock = ref("");
const chat = ref(null);
const notice = ref(null);
const online = ref([]);
const inbox = ref([]);
const unread = ref(0);
const dmText = ref("");
const dmError = ref("");
const dmBusy = ref(false);
const sentMap = ref({});
const threadEl = ref(null);
let beatTimer = 0;

const loggedIn = computed(() => Boolean(studentToken.value));

function myId() {
  const parts = String(studentToken.value || "").split(".");
  if (parts.length !== 3 || parts[0] !== "s") return "";
  try {
    const pad = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const raw = pad + "===".slice((pad.length + 3) % 4);
    return decodeURIComponent(escape(atob(raw)));
  } catch (err) {
    return "";
  }
}

function othersOnline() {
  const me = myId();
  return online.value.filter((person) => person.studentId !== me);
}

const conversations = computed(() => {
  const map = {};
  inbox.value.forEach((msg) => {
    if (msg.type !== "dm" || !msg.fromStudentId) return;
    const cur = map[msg.fromStudentId];
    if (!cur || String(msg.createdAt) > String(cur.last.createdAt)) {
      map[msg.fromStudentId] = {
        studentId: msg.fromStudentId,
        label: msg.fromName,
        last: msg,
        unread: 0,
        avatar: Boolean(msg.fromAvatar),
        avatarAt: msg.fromAvatarAt || "",
      };
    }
  });
  inbox.value.forEach((msg) => {
    if (msg.type === "dm" && msg.fromStudentId && !msg.read && map[msg.fromStudentId]) {
      map[msg.fromStudentId].unread += 1;
    }
  });
  return Object.values(map).sort((a, b) => String(b.last.createdAt).localeCompare(String(a.last.createdAt)));
});

const notices = computed(() =>
  inbox.value.filter((msg) => msg.type !== "dm").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
);

const thread = computed(() => {
  if (!chat.value) return [];
  const incoming = inbox.value
    .filter((msg) => msg.type === "dm" && msg.fromStudentId === chat.value.studentId)
    .map((msg) => ({
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt,
      mine: false,
    }));
  const outgoing = sentMap.value[chat.value.studentId] || [];
  return incoming.concat(outgoing).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
});

function formatTime(value) {
  return String(value || "").slice(0, 16).replace("T", " ");
}

function initial(label) {
  const text = String(label || "").trim();
  return text ? text.slice(0, 1) : "?";
}

function faceUrl(person) {
  const studentId = person && (person.studentId || person.fromStudentId);
  if (!studentId || !studentToken.value) return "";
  const has = person.avatar || person.fromAvatar;
  if (!has) return "";
  return api.avatarUrl(studentToken.value, studentId, person.avatarAt || person.fromAvatarAt || "");
}

async function beat() {
  if (!studentToken.value) {
    online.value = [];
    unread.value = 0;
    return;
  }
  try {
    const data = await api.heartbeat(studentToken.value);
    online.value = data.students || [];
    unread.value = data.unread || 0;
  } catch (err) {
    if (/登录|失效|401/.test(err.message)) setStudentToken("");
  }
}

async function loadInbox() {
  if (!studentToken.value) return;
  try {
    const data = await api.inbox(studentToken.value);
    inbox.value = data.items || [];
    unread.value = data.unread || 0;
  } catch (err) {
    inbox.value = [];
  }
}

async function markRead(ids) {
  if (!ids.length || !studentToken.value) return;
  try {
    const data = await api.inboxRead(studentToken.value, ids);
    inbox.value = data.items || inbox.value;
    unread.value = data.unread || 0;
  } catch (err) {
    /* 已读失败不影响聊天 */
  }
}

function toggleDock(name) {
  dock.value = dock.value === name ? "" : name;
  notice.value = null;
  if (dock.value === "inbox") loadInbox();
  if (dock.value === "online") beat();
}

function startChat(person) {
  chat.value = {
    studentId: person.studentId,
    label: person.label || person.fromName || person.name,
    avatar: Boolean(person.avatar || person.fromAvatar),
    avatarAt: person.avatarAt || person.fromAvatarAt || "",
  };
  dmText.value = "";
  dmError.value = "";
  dock.value = "";
  notice.value = null;
  const ids = inbox.value
    .filter((msg) => msg.type === "dm" && msg.fromStudentId === person.studentId && !msg.read)
    .map((msg) => msg.id);
  markRead(ids);
  scrollThread();
}

function openNotice(msg) {
  notice.value = msg;
  if (!msg.read) markRead([msg.id]);
}

function closeChat() {
  chat.value = null;
  dmError.value = "";
}

async function scrollThread() {
  await nextTick();
  if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight;
}

async function sendDm() {
  if (!chat.value || !dmText.value.trim()) return;
  const text = dmText.value.trim();
  dmBusy.value = true;
  dmError.value = "";
  try {
    await api.inboxDm(studentToken.value, chat.value.studentId, text);
    const list = (sentMap.value[chat.value.studentId] || []).slice();
    list.push({
      id: "local-" + Date.now(),
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
    });
    sentMap.value = Object.assign({}, sentMap.value, { [chat.value.studentId]: list });
    dmText.value = "";
    scrollThread();
  } catch (err) {
    dmError.value = te(err.message);
  } finally {
    dmBusy.value = false;
  }
}

function startLoop() {
  clearInterval(beatTimer);
  if (!studentToken.value) {
    online.value = [];
    unread.value = 0;
    inbox.value = [];
    dock.value = "";
    chat.value = null;
    return;
  }
  beat();
  beatTimer = window.setInterval(beat, 30000);
}

watch(studentToken, startLoop);
watch(thread, scrollThread);
onMounted(startLoop);
onUnmounted(() => clearInterval(beatTimer));
</script>

<template>
  <aside v-if="loggedIn" class="dock" aria-label="chat">
    <div v-if="chat" class="box chat">
      <header class="head">
        <span class="face" aria-hidden="true">
          <img v-if="faceUrl(chat)" :src="faceUrl(chat)" alt="" />
          <ImbaAvatar v-else :size="40" />
        </span>
        <div class="who">
          <strong>{{ chat.label }}</strong>
          <span>{{ t("nav.chatNow") }}</span>
        </div>
        <button class="x" type="button" :aria-label="t('nav.chatClose')" @click="closeChat">×</button>
      </header>
      <div ref="threadEl" class="thread">
        <p v-if="!thread.length" class="empty">{{ t("nav.chatEmpty") }}</p>
        <div v-for="msg in thread" :key="msg.id" class="line" :class="{ mine: msg.mine }">
          <div class="bubble">{{ msg.body }}</div>
          <time>{{ formatTime(msg.createdAt) }}</time>
        </div>
      </div>
      <p v-if="dmError" class="err">{{ dmError }}</p>
      <form class="composer" @submit.prevent="sendDm">
        <input v-model="dmText" type="text" :placeholder="t('nav.dmPlaceholder')" maxlength="1000" />
        <button type="submit" :disabled="dmBusy || !dmText.trim()">{{ t("nav.send") }}</button>
      </form>
    </div>

    <div v-if="dock === 'online'" class="box list">
      <header class="head">
        <strong>{{ t("nav.onlineTitle", { n: othersOnline().length }) }}</strong>
        <button class="x" type="button" :aria-label="t('nav.chatClose')" @click="dock = ''">×</button>
      </header>
      <div class="scroll">
        <button
          v-for="person in othersOnline()"
          :key="person.studentId"
          class="person"
          type="button"
          @click="startChat(person)"
        >
          <span class="face">
            <img v-if="faceUrl(person)" :src="faceUrl(person)" alt="" />
            <ImbaAvatar v-else :size="40" />
            <i class="dot"></i>
          </span>
          <span class="meta">
            <strong>{{ person.label }}</strong>
            <em>{{ t("nav.chatNow") }}</em>
          </span>
        </button>
        <p v-if="!othersOnline().length" class="empty">{{ t("nav.onlineEmpty") }}</p>
      </div>
    </div>

    <div v-if="dock === 'inbox'" class="box list">
      <header class="head">
        <strong>{{ t("nav.inboxTitle") }}</strong>
        <button class="x" type="button" :aria-label="t('nav.chatClose')" @click="dock = ''; notice = null">×</button>
      </header>
      <div class="scroll">
        <template v-if="notice">
          <button class="back" type="button" @click="notice = null">{{ t("nav.back") }}</button>
          <article class="notice">
            <strong>{{ notice.title }}</strong>
            <span>{{ notice.fromName }} · {{ formatTime(notice.createdAt) }}</span>
            <p>{{ notice.body }}</p>
            <a v-if="notice.jobId" href="/jobs">{{ t("nav.viewJob") }}</a>
          </article>
        </template>
        <template v-else>
          <button
            v-for="item in conversations"
            :key="item.studentId"
            class="person"
            type="button"
            @click="startChat(item)"
          >
            <span class="face">
              <img v-if="faceUrl(item)" :src="faceUrl(item)" alt="" />
              <ImbaAvatar v-else :size="40" />
            </span>
            <span class="meta">
              <strong>{{ item.label }}</strong>
              <em>{{ item.last.body }}</em>
            </span>
            <b v-if="item.unread" class="badge">{{ item.unread }}</b>
          </button>
          <button
            v-for="msg in notices"
            :key="msg.id"
            class="person sys"
            type="button"
            @click="openNotice(msg)"
          >
            <span class="face sys">{{ initial(msg.fromName || msg.title) }}</span>
            <span class="meta">
              <strong>{{ msg.title }}</strong>
              <em>{{ msg.body }}</em>
            </span>
            <b v-if="!msg.read" class="badge">1</b>
          </button>
          <p v-if="!conversations.length && !notices.length" class="empty">{{ t("nav.inboxEmpty") }}</p>
        </template>
      </div>
    </div>

    <div class="launchers">
      <button
        class="fab"
        type="button"
        :class="{ on: dock === 'inbox' }"
        :title="t('nav.inbox')"
        :aria-label="t('nav.inbox')"
        @click="toggleDock('inbox')"
      >
        <svg class="mail" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.2" y="6.4" width="15.6" height="11.2" rx="1.6" />
          <path d="M5.2 7.6 12 12.4 18.8 7.6" />
        </svg>
        <span v-if="unread" class="badge fab-badge">{{ unread }}</span>
      </button>
      <button
        class="fab"
        type="button"
        :class="{ on: dock === 'online' }"
        :title="t('nav.online', { n: othersOnline().length })"
        :aria-label="t('nav.online', { n: othersOnline().length })"
        @click="toggleDock('online')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12zm0 2.2c-3.5 0-8 1.7-8 5.1V21h16v-1.7c0-3.4-4.5-5.1-8-5.1z"/>
        </svg>
        <i v-if="othersOnline().length" class="live"></i>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.dock {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.box {
  width: min(360px, calc(100vw - 24px));
  background: #fff;
  color: #1c1e21;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(22, 24, 58, 0.22);
  overflow: hidden;
  border: 1px solid #e6e8ee;
}

.chat { height: min(460px, calc(100vh - 110px)); display: flex; flex-direction: column; }
.list { max-height: min(420px, calc(100vh - 110px)); display: flex; flex-direction: column; }

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f0f2f5;
  border-bottom: 1px solid #e4e6eb;
}

.who { flex: 1; min-width: 0; }
.who strong, .head > strong { display: block; font-size: 14px; }
.who span { font-size: 11px; color: #31a24c; }

.x {
  border: 0;
  background: transparent;
  color: #65676b;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.face {
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  min-width: 40px;
  max-width: 40px;
  min-height: 40px;
  max-height: 40px;
  border-radius: 40px;
  background: #e4e6eb;
  color: #4b5070;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  line-height: 0;
  font-size: 14px;
  font-weight: 700;
}

.face img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  display: block;
  border-radius: 40px;
}

.face svg {
  display: block;
  width: 22px;
  height: 22px;
  fill: currentColor;
}
.face.sys { background: var(--navy); color: #fff; }

.dot, .live {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #31a24c;
  border: 2px solid #fff;
  right: -1px;
  bottom: -1px;
}

.scroll { overflow: auto; padding: 6px; }
.person {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.person:hover { background: #f0f2f5; }

.meta { flex: 1; min-width: 0; }
.meta strong, .meta em { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta strong { font-size: 14px; }
.meta em { font-size: 12px; color: #65676b; font-style: normal; margin-top: 2px; }

.badge {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #e41e3f;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.thread {
  flex: 1;
  overflow: auto;
  padding: 12px 10px;
  background: #fff;
}

.line { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px; }
.line.mine { align-items: flex-end; }
.bubble {
  max-width: 78%;
  padding: 8px 11px;
  border-radius: 16px;
  background: #e4e6eb;
  color: #050505;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}
.line.mine .bubble { background: var(--navy); color: #fff; }
.line time { font-size: 10px; color: #8a8d91; margin-top: 3px; }

.composer {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid #e4e6eb;
  background: #f0f2f5;
}
.composer input {
  flex: 1;
  border: 0;
  border-radius: 18px;
  padding: 8px 12px;
  font: inherit;
  font-size: 14px;
  background: #fff;
  color: #050505;
}
.composer button {
  border: 0;
  background: var(--navy);
  color: #fff;
  border-radius: 18px;
  padding: 8px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.composer button:disabled { opacity: 0.45; cursor: default; }

.err { margin: 0; padding: 0 12px 6px; color: #c0392b; font-size: 12px; }
.empty { margin: 16px 8px; color: #65676b; font-size: 13px; text-align: center; }
.back {
  border: 0;
  background: transparent;
  color: var(--navy);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  padding: 6px 8px;
}
.notice { padding: 8px 10px 14px; }
.notice strong { display: block; font-size: 14px; }
.notice span { font-size: 12px; color: #65676b; }
.notice p { margin: 8px 0; font-size: 14px; line-height: 1.5; color: #1c1e21; }
.notice a { color: var(--navy); font-size: 13px; }

.launchers { display: flex; gap: 8px; }
.fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  background: #fff;
  color: var(--navy);
  box-shadow: 0 6px 18px rgba(22, 24, 58, 0.2);
  cursor: pointer;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.fab.on { background: var(--navy); color: #fff; }
.fab svg { width: 20px; height: 20px; fill: currentColor; }
.fab svg.mail { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; }
.fab-badge { position: absolute; top: -4px; right: -4px; }
.live {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
}

@media (max-width: 720px) {
  .dock { right: 10px; bottom: 10px; }
  .box { width: min(100vw - 20px, 360px); }
}
</style>
