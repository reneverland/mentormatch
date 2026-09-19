<script setup>
import { computed, reactive, ref } from "vue";
import api from "../api";
import { t, te } from "../i18n";

const props = defineProps({
  // 浮窗入口默认「已注册」，匹配页内仍然默认「首次注册」。
  initialMode: { type: String, default: "register" },
});

const emit = defineEmits(["authed"]);

const mode = ref(props.initialMode === "login" ? "login" : "register");
const busy = ref(false);
const error = ref("");

const form = reactive({
  inviteCode: "",
  password: "",
  name: "",
  studentId: "",
  enrollYear: "",
  email: "",
  navigator: "",
  resumeName: "",
  resumeBase64: "",
});

const years = computed(() => {
  const current = new Date().getFullYear();
  const list = [];
  for (let y = current + 1; y >= current - 5; y -= 1) list.push(String(y));
  return list;
});

function onResume(event) {
  const file = event.target.files && event.target.files[0];
  error.value = "";
  if (!file) {
    form.resumeName = "";
    form.resumeBase64 = "";
    return;
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    error.value = t("login.resumePdf");
    event.target.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    error.value = t("login.resumeSize");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.resumeName = file.name;
    form.resumeBase64 = String(reader.result).split(",")[1] || "";
  };
  reader.readAsDataURL(file);
}

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    let result;
    if (mode.value === "register") {
      result = await api.register({
        inviteCode: form.inviteCode.trim(),
        name: form.name.trim(),
        studentId: form.studentId.trim(),
        enrollYear: form.enrollYear,
        email: form.email.trim(),
        navigator: form.navigator === "yes",
        resumeFilename: form.resumeName,
        resumeBase64: form.resumeBase64,
      });
    } else {
      result = await api.login({
        studentId: form.studentId.trim(),
        password: form.password,
      });
    }
    emit("authed", result.token);
  } catch (err) {
    error.value = te(err.message);
  } finally {
    busy.value = false;
  }
}

const canSubmit = computed(() => {
  if (!form.studentId.trim()) return false;
  if (mode.value === "login") return Boolean(form.password);
  return Boolean(
    form.inviteCode.trim() &&
      form.name.trim() &&
      form.enrollYear &&
      form.email.trim() &&
      form.navigator &&
      form.resumeBase64
  );
});
</script>

<template>
  <section class="gate">
    <div class="tabs">
      <button
        type="button"
        :class="{ on: mode === 'register' }"
        @click="mode = 'register'; error = ''"
      >
        {{ t("login.register") }}
      </button>
      <button
        type="button"
        :class="{ on: mode === 'login' }"
        @click="mode = 'login'; error = ''"
      >
        {{ t("login.again") }}
      </button>
    </div>

    <p class="hint">
      {{ t("login.hint") }}
    </p>

    <p v-if="error" class="alert error">{{ error }}</p>

    <form @submit.prevent="submit">
      <label v-if="mode === 'register'" class="field">
        <span>{{ t("login.invite") }}</span>
        <input v-model="form.inviteCode" type="text" autocomplete="off" :placeholder="t('login.invitePh')" />
      </label>

      <label class="field">
        <span>{{ t("login.sid") }}</span>
        <input v-model="form.studentId" type="text" autocomplete="off" :placeholder="t('login.sidPh')" />
      </label>

      <label v-if="mode === 'login'" class="field">
        <span>{{ t("login.password") }}</span>
        <input v-model="form.password" type="password" autocomplete="current-password" :placeholder="t('login.passwordPh')" />
      </label>

      <template v-if="mode === 'register'">
        <label class="field">
          <span>{{ t("login.name") }}</span>
          <input v-model="form.name" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span>{{ t("login.year") }}</span>
          <select v-model="form.enrollYear">
            <option value="">{{ t("login.choose") }}</option>
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>

        <label class="field">
          <span>{{ t("login.email") }}</span>
          <input v-model="form.email" type="email" autocomplete="off" />
        </label>

        <label class="field">
          <span>{{ t("login.navigator") }}</span>
          <select v-model="form.navigator">
            <option value="">{{ t("login.choose") }}</option>
            <option value="yes">{{ t("login.yes") }}</option>
            <option value="no">{{ t("login.no") }}</option>
          </select>
        </label>
        <p class="sub-hint">{{ t("login.navHint") }}</p>

        <label class="field">
          <span>{{ t("login.resume") }}</span>
          <input type="file" accept="application/pdf" @change="onResume" />
        </label>
        <p class="sub-hint">
          {{ t("login.resumeHint") }}
          <span v-if="form.resumeName" class="picked">{{ t("login.picked", { name: form.resumeName }) }}</span>
        </p>
      </template>

      <button class="btn" type="submit" :disabled="!canSubmit || busy">
        {{ busy ? t("login.submitBusy") : mode === "register" ? t("login.submitReg") : t("login.submitIn") }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.gate {
  max-width: 520px;
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px 26px 30px;
  box-shadow: var(--shadow);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tabs button {
  flex: 1;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 10px;
  padding: 9px 12px;
  font: inherit;
  color: var(--muted);
  cursor: pointer;
}

.tabs button.on {
  background: var(--purple);
  border-color: transparent;
  color: #fff;
  font-weight: 650;
}

.hint {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--muted);
}

.sub-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: var(--muted);
}

.picked {
  display: block;
  margin-top: 4px;
  color: var(--good);
  font-weight: 650;
}

form .btn { width: 100%; margin-top: 6px; }

input[type="file"] {
  width: 100%;
  font: inherit;
  font-size: 13px;
}
</style>
