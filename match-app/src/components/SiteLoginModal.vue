<script setup>
import { ref } from "vue";
import LoginView from "../views/LoginView.vue";
import api from "../api";
import { setStudentToken, setAdminToken } from "../session";
import { t, te } from "../i18n";

const emit = defineEmits(["close"]);

const role = ref("student");
const adminPassword = ref("");
const adminBusy = ref(false);
const adminError = ref("");

function onAuthed(token) {
  setStudentToken(token);
  emit("close");
}

async function adminLogin() {
  adminError.value = "";
  adminBusy.value = true;
  try {
    const data = await api.adminLogin(adminPassword.value);
    setAdminToken(data.token);
    adminPassword.value = "";
    emit("close");
    if (typeof window !== "undefined" && window.location.pathname.indexOf("/admin") !== 0) {
      window.location.href = "/admin";
    }
  } catch (err) {
    adminError.value = te(err.message);
  } finally {
    adminBusy.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="mask" @click.self="emit('close')">
      <div class="sheet" role="dialog" aria-labelledby="login-title">
        <div class="sheet-head">
          <h2 id="login-title">{{ t("login.title") }}</h2>
          <button class="close" type="button" :aria-label="t('login.close')" @click="emit('close')">×</button>
        </div>
        <div class="roles">
          <button type="button" :class="{ on: role === 'student' }" @click="role = 'student'">{{ t("login.student") }}</button>
          <button type="button" :class="{ on: role === 'admin' }" @click="role = 'admin'">{{ t("login.admin") }}</button>
        </div>
        <LoginView v-if="role === 'student'" initial-mode="login" @authed="onAuthed" />
        <section v-else class="gate">
          <p class="hint">{{ t("login.adminHint") }}</p>
          <p v-if="adminError" class="alert error">{{ adminError }}</p>
          <label class="field">
            <span>{{ t("login.adminPassword") }}</span>
            <input v-model="adminPassword" type="password" @keyup.enter="adminLogin" />
          </label>
          <button class="btn" type="button" :disabled="!adminPassword || adminBusy" @click="adminLogin">
            {{ adminBusy ? t("login.adminBusy") : t("login.adminGo") }}
          </button>
        </section>
        <p class="mentor-hint">
          {{ t("login.mentorHint") }}
          <a href="/match/mentor">{{ t("login.mentorLink") }}</a>
          {{ t("login.mentorTail") }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(22, 24, 58, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 72px 16px 24px;
  overflow: auto;
}

.sheet {
  width: min(560px, 100%);
  background: transparent;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #fff;
}

.sheet-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

.close {
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.roles {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.roles button {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: #fff;
  font: inherit;
  padding: 8px 12px;
  cursor: pointer;
}

.roles button.on {
  background: #fff;
  color: var(--navy);
  font-weight: 650;
}

.gate {
  max-width: 520px;
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px 26px 30px;
  box-shadow: var(--shadow);
}

.gate .btn { width: 100%; }

.mentor-hint {
  margin: 12px 4px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
}

.mentor-hint a { color: var(--gold-soft); }
</style>
