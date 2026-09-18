<script setup>
import { computed, reactive, ref } from "vue";
import api from "../api";

const emit = defineEmits(["authed"]);

const mode = ref("register");
const busy = ref(false);
const error = ref("");

const form = reactive({
  inviteCode: "",
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
    error.value = "简历请上传 PDF 格式。";
    event.target.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    error.value = "简历请控制在 8MB 以内。";
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
      });
      if (form.resumeBase64) {
        await api.uploadResume(result.token, form.resumeName, form.resumeBase64);
      }
    } else {
      result = await api.login({
        inviteCode: form.inviteCode.trim(),
        studentId: form.studentId.trim(),
      });
    }
    emit("authed", result.token);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

const canSubmit = computed(() => {
  if (!form.inviteCode.trim() || !form.studentId.trim()) return false;
  if (mode.value === "login") return true;
  return Boolean(form.name.trim() && form.enrollYear && form.email.trim() && form.navigator);
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
        首次注册
      </button>
      <button
        type="button"
        :class="{ on: mode === 'login' }"
        @click="mode = 'login'; error = ''"
      >
        已注册 · 再次进入
      </button>
    </div>

    <p class="hint">
      注册需要学校下发的验证邀请码，仅本项目学生可用。再次进入只需学号加同一邀请码。
    </p>

    <p v-if="error" class="alert error">{{ error }}</p>

    <form @submit.prevent="submit">
      <label class="field">
        <span>验证邀请码 *</span>
        <input v-model="form.inviteCode" type="text" autocomplete="off" placeholder="学校下发的邀请码" />
      </label>

      <label class="field">
        <span>学号 *</span>
        <input v-model="form.studentId" type="text" autocomplete="off" placeholder="例如 223040000" />
      </label>

      <template v-if="mode === 'register'">
        <label class="field">
          <span>姓名 *</span>
          <input v-model="form.name" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span>入学年份 *</span>
          <select v-model="form.enrollYear">
            <option value="">请选择</option>
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>

        <label class="field">
          <span>邮箱 *</span>
          <input v-model="form.email" type="email" autocomplete="off" />
        </label>

        <label class="field">
          <span>是否愿意担任该组领航员 *</span>
          <select v-model="form.navigator">
            <option value="">请选择</option>
            <option value="yes">愿意</option>
            <option value="no">不愿意</option>
          </select>
        </label>
        <p class="sub-hint">主要职责：协助导师需要、传达辅导通知、组内小型活动组织等。</p>

        <label class="field">
          <span>最新简历（PDF，选填）</span>
          <input type="file" accept="application/pdf" @change="onResume" />
        </label>
        <p class="sub-hint">建议命名：学号_姓名。不上传也可以完成注册与选导师。</p>
      </template>

      <button class="btn" type="submit" :disabled="!canSubmit || busy">
        {{ busy ? "提交中…" : mode === "register" ? "注册并进入" : "进入" }}
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
  border-radius: 22px;
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
  border-radius: 999px;
  padding: 9px 12px;
  font: inherit;
  color: var(--muted);
  cursor: pointer;
}

.tabs button.on {
  background: linear-gradient(135deg, var(--purple), var(--purple-mid));
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

form .btn { width: 100%; margin-top: 6px; }

input[type="file"] {
  width: 100%;
  font: inherit;
  font-size: 13px;
}
</style>
