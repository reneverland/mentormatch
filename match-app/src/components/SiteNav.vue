<script setup>
import { computed, onMounted, ref, watch } from "vue";
import SiteLoginModal from "./SiteLoginModal.vue";
import SiteChatDock from "./SiteChatDock.vue";
import ImbaAvatar from "./ImbaAvatar.vue";
import api from "../api";
import { studentToken, setStudentToken, adminToken, setAdminToken } from "../session";
import { t, te, toggleLocale } from "../i18n";

const path = typeof window !== "undefined" ? window.location.pathname : "/";
const logoUrl = import.meta.env.BASE_URL + "imba-nav.png";
const showLogin = ref(false);
const panel = ref("");
const me = ref(null);
const pwdCurrent = ref("");
const pwdNext = ref("");
const pwdAgain = ref("");
const pwdError = ref("");
const pwdNotice = ref("");
const pwdBusy = ref(false);
const avatarBusy = ref(false);
const resumeBusy = ref(false);
const resumeTick = ref(0);

function on(href) {
  if (href === "/") return path === "/" || path === "/index.html";
  if (href === "/match") {
    return path.indexOf("/match") === 0 && path.indexOf("/match/mentor") !== 0 && path.indexOf("/match/admin") !== 0;
  }
  return path === href || path.indexOf(href + "/") === 0;
}

const avatarSrc = computed(() => {
  if (!me.value || !me.value.avatar || !studentToken.value) return "";
  return api.avatarUrl(studentToken.value, me.value.studentId, me.value.avatarAt);
});

const resumePreviewUrl = computed(() => {
  if (!me.value || !me.value.resume || !studentToken.value) return "";
  return api.studentResumeUrl(studentToken.value) +
    "&v=" + encodeURIComponent((me.value.resumeName || "") + "-" + resumeTick.value);
});

async function loadMe() {
  if (!studentToken.value) {
    me.value = null;
    return;
  }
  try {
    const data = await api.state(studentToken.value);
    me.value = data.me || null;
  } catch (err) {
    me.value = null;
  }
}

function resetAccountForm() {
  pwdCurrent.value = "";
  pwdNext.value = "";
  pwdAgain.value = "";
  pwdError.value = "";
  pwdNotice.value = "";
}

function openAccount() {
  panel.value = panel.value === "account" ? "" : "account";
  resetAccountForm();
  if (panel.value === "account") loadMe();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(new Error("读取文件失败。"));
    reader.readAsDataURL(file);
  });
}

async function onAvatarChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file || !studentToken.value) return;
  if (file.size > 3 * 1024 * 1024) {
    pwdError.value = t("nav.avatarTooBig");
    pwdNotice.value = "";
    return;
  }
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    pwdError.value = t("nav.avatarType");
    pwdNotice.value = "";
    return;
  }
  avatarBusy.value = true;
  pwdError.value = "";
  pwdNotice.value = "";
  try {
    const dataBase64 = await fileToBase64(file);
    const data = await api.uploadAvatar(studentToken.value, file.name, dataBase64);
    if (data.me) me.value = data.me;
    pwdNotice.value = t("nav.avatarOk");
  } catch (err) {
    pwdError.value = te(err.message);
  } finally {
    avatarBusy.value = false;
  }
}

async function onResumeChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file || !studentToken.value) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    pwdError.value = t("login.resumePdf");
    pwdNotice.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    pwdError.value = t("login.resumeSize");
    pwdNotice.value = "";
    return;
  }
  resumeBusy.value = true;
  pwdError.value = "";
  pwdNotice.value = "";
  try {
    const dataBase64 = await fileToBase64(file);
    const data = await api.uploadResume(studentToken.value, file.name, dataBase64);
    if (data.me) me.value = data.me;
    else await loadMe();
    resumeTick.value += 1;
    pwdNotice.value = t("nav.resumeOk");
  } catch (err) {
    pwdError.value = te(err.message);
  } finally {
    resumeBusy.value = false;
  }
}

async function savePassword() {
  if (pwdNext.value !== pwdAgain.value) {
    pwdError.value = t("nav.pwdMismatch");
    pwdNotice.value = "";
    return;
  }
  pwdBusy.value = true;
  pwdError.value = "";
  pwdNotice.value = "";
  try {
    const data = await api.studentPassword(studentToken.value, pwdCurrent.value, pwdNext.value);
    if (data.token) setStudentToken(data.token);
    pwdCurrent.value = "";
    pwdNext.value = "";
    pwdAgain.value = "";
    pwdNotice.value = t("nav.pwdOk");
  } catch (err) {
    pwdError.value = te(err.message);
  } finally {
    pwdBusy.value = false;
  }
}

function logout() {
  setStudentToken("");
  panel.value = "";
  me.value = null;
  resetAccountForm();
}

const loggedIn = computed(() => Boolean(studentToken.value));

watch(studentToken, (token) => {
  if (token) loadMe();
  else {
    me.value = null;
    panel.value = "";
  }
});
onMounted(loadMe);
</script>

<template>
  <nav class="nav">
    <div class="inner">
      <a class="brand" href="/" :aria-label="t('home.lede')">
        <img class="logo" :src="logoUrl" :alt="t('home.title')" />
        <span class="brand-text">{{ t("nav.brand") }}</span>
      </a>
      <div class="aside">
        <button
          class="lang"
          type="button"
          :title="t('nav.lang')"
          :aria-label="t('nav.lang')"
          @click="toggleLocale"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7" />
            <path d="M3.8 12h16.4M12 3.8c2.4 2.4 3.6 5.2 3.6 8.2s-1.2 5.8-3.6 8.2M12 3.8c-2.4 2.4-3.6 5.2-3.6 8.2s1.2 5.8 3.6 8.2" stroke="currentColor" stroke-width="1.7" />
          </svg>
          <span>{{ t("nav.langShort") }}</span>
        </button>
        <button
          v-if="loggedIn"
          class="chip"
          type="button"
          @click="openAccount"
        >{{ t("nav.account") }}</button>
        <a v-if="adminToken" class="chip" :class="{ on: on('/admin') }" href="/admin">{{ t("nav.admin") }}</a>
        <button v-if="adminToken" class="chip" type="button" @click="setAdminToken('')">{{ t("nav.logoutAdmin") }}</button>
        <button v-if="loggedIn" class="login" type="button" @click="logout">{{ t("nav.logout") }}</button>
        <button class="login" type="button" @click="showLogin = true">{{ t("nav.login") }}</button>
      </div>
    </div>

    <div v-if="panel === 'account'" class="sheet">
      <p class="sheet-title">{{ t("nav.accountTitle") }}</p>
      <p v-if="pwdError" class="alert error">{{ pwdError }}</p>
      <p v-if="pwdNotice" class="alert ok">{{ pwdNotice }}</p>
      <div class="account">
        <span class="portrait" :class="{ photo: avatarSrc }" aria-hidden="true">
          <img v-if="avatarSrc" :src="avatarSrc" alt="" />
          <ImbaAvatar v-else :size="72" />
        </span>
        <div class="who">
          <strong>{{ me && me.name ? me.name : t("nav.account") }}</strong>
          <em v-if="me">{{ t("nav.sid") }} {{ me.studentId }}</em>
          <label class="pick">
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="avatarBusy" hidden @change="onAvatarChange" />
            <span class="btn ghost">{{ t("nav.avatarPick") }}</span>
          </label>
          <span class="hint">{{ t("nav.avatarHint") }}</span>
        </div>
      </div>
      <p class="sheet-title sub">{{ t("nav.resumeTitle") }}</p>
      <p class="resume-status">
        {{ me && me.resume ? t("nav.resumeHave", { name: me.resumeName || "CV.pdf" }) : t("nav.resumeNone") }}
      </p>
      <div v-if="resumePreviewUrl" class="resume-view">
        <iframe
          :src="resumePreviewUrl"
          :title="t('nav.resumePreview')"
          class="resume-frame"
        ></iframe>
      </div>
      <div class="resume-actions">
        <label class="pick">
          <input type="file" accept="application/pdf,.pdf" :disabled="resumeBusy" hidden @change="onResumeChange" />
          <span class="btn ghost">{{ me && me.resume ? t("nav.resumeReplace") : t("nav.resumePick") }}</span>
        </label>
      </div>
      <span class="hint">{{ t("nav.resumeHint") }}</span>
      <p class="sheet-title sub">{{ t("nav.pwdTitle") }}</p>
      <label class="field">
        <span>{{ t("nav.curPwd") }}</span>
        <input v-model="pwdCurrent" type="password" autocomplete="current-password" />
      </label>
      <label class="field">
        <span>{{ t("nav.newPwd") }}</span>
        <input v-model="pwdNext" type="password" autocomplete="new-password" />
      </label>
      <label class="field">
        <span>{{ t("nav.againPwd") }}</span>
        <input v-model="pwdAgain" type="password" autocomplete="new-password" />
      </label>
      <div class="pwd-actions">
        <button
          class="btn"
          type="button"
          :disabled="pwdBusy || !pwdCurrent || pwdNext.length < 6"
          @click="savePassword"
        >{{ t("nav.savePwd") }}</button>
      </div>
    </div>

    <SiteLoginModal v-if="showLogin" @close="showLogin = false" />
    <SiteChatDock />
  </nav>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--navy);
  border-bottom: 2px solid var(--gold);
}

.inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  min-width: 0;
}

.logo {
  height: 48px;
  width: auto;
  display: block;
}

.brand-text { display: none; }

.aside {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.lang {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(196, 163, 90, 0.7);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  padding: 5px 9px;
  cursor: pointer;
}

.lang svg {
  width: 15px;
  height: 15px;
}

.lang:hover { background: rgba(196, 163, 90, 0.16); }

.chip {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
  position: relative;
  text-decoration: none;
}

.chip.on { border-color: var(--gold); }

.login {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 1px solid var(--gold);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.login:hover { background: rgba(196, 163, 90, 0.16); }

.sheet {
  max-width: 1180px;
  margin: 0 auto;
  padding: 12px 24px 16px;
  color: #fff;
}

.sheet-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--gold-soft);
  font-weight: 650;
}

.account {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0 4px;
}

.portrait {
  box-sizing: border-box;
  width: 72px;
  height: 72px;
  min-width: 72px;
  border-radius: 72px;
  overflow: hidden;
  background: transparent;
  display: grid;
  place-items: center;
}

.portrait.photo {
  border: 2px solid rgba(196, 163, 90, 0.85);
  background: rgba(255, 255, 255, 0.12);
}

.portrait img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  display: block;
}

.resume-status {
  margin: 0 0 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.who { min-width: 0; }
.who strong { display: block; font-size: 15px; }
.who em {
  display: block;
  margin: 3px 0 8px;
  font-size: 12px;
  font-style: normal;
  color: rgba(255, 255, 255, 0.65);
}
.hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.sheet-title.sub { margin-top: 16px; }

.resume-view {
  margin: 0 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.resume-frame {
  display: block;
  width: 100%;
  height: min(420px, 56vh);
  border: 0;
  background: #fff;
}

.resume-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pick { display: inline-block; cursor: pointer; }
.btn.ghost {
  display: inline-block;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}

.pwd-actions { display: flex; gap: 8px; margin-top: 10px; }
.pwd-actions .btn { min-width: 88px; }

.sheet .field { margin-bottom: 10px; }
.sheet .field > span { color: rgba(255, 255, 255, 0.72); }
.sheet .field input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font: inherit;
  padding: 8px 10px;
}

@media (max-width: 720px) {
  .inner { flex-wrap: wrap; padding: 10px 16px 12px; min-height: 0; }
  .brand { flex: 1; }
  .logo { height: 40px; }
  .brand-text { display: inline; color: #fff; font-weight: 650; font-size: 14px; }
}
</style>
