<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import SiteHero from "../components/SiteHero.vue";
import MessageFeed from "../components/MessageFeed.vue";
import JobCard from "../components/JobCard.vue";
import mentors from "../data/mentors";
import api from "../api";
import { adminToken, setAdminToken } from "../session";
import { t, te } from "../i18n";

const loading = ref(false);
const error = ref("");
const notice = ref("");
const moduleId = ref("");
const students = ref([]);
const counts = ref({});
const mentorAccounts = ref([]);
const messages = ref([]);
const messageMentor = ref("");
const jobs = ref([]);
const applies = ref([]);
const showPreview = ref(false);
const testMailTo = ref("");
const jobSettings = reactive({
  adTitle: "",
  adText: "",
  adImage: "",
  cvInboxEmail: "msimba@cuhk.edu.cn",
  smtp: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromName: "IMBA 学生服务",
    fromEmail: "",
    configured: false,
  },
});

const blankJob = () => ({
  id: "",
  company: "",
  title: "",
  city: "",
  experience: "",
  education: "",
  salary: "",
  type: "fulltime",
  audience: "",
  description: "",
  cvEmail: "",
  status: "draft",
});

const jobEditor = reactive(blankJob());

const modules = computed(() => [
  { id: "match", title: t("admin.modMatch"), desc: t("admin.modMatchDesc") },
  { id: "students", title: t("admin.modStudents"), desc: t("admin.modStudentsDesc") },
  { id: "mentors", title: t("admin.modMentors"), desc: t("admin.modMentorsDesc") },
  { id: "messages", title: t("admin.modMessages"), desc: t("admin.modMessagesDesc") },
  { id: "jobs", title: t("admin.modJobs"), desc: t("admin.modJobsDesc") },
  { id: "coord", title: t("admin.modCoord"), desc: t("admin.modCoordDesc") },
]);

const coordSettings = reactive({
  enabled: true,
  title: "IBA6313 实习课程",
  intervalMin: 10,
  zoomId: "633486699806",
  zoomPassword: "050767",
  windows: [{ date: "2026-09-26", start: "10:00", end: "12:00" }],
});
const coordBookings = ref([]);
const coordSlots = ref([]);

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
    await loadJobs();
    await loadCoord();
  } catch (err) {
    error.value = te(err.message);
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
    notice.value = t("admin.saved");
    await load();
  } catch (err) {
    error.value = te(err.message);
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
  jobs.value = [];
  applies.value = [];
  coordBookings.value = [];
  moduleId.value = "";
}

async function loadCoord() {
  if (!adminToken.value) return;
  const data = await api.adminCoord(adminToken.value);
  Object.assign(coordSettings, data.settings || {});
  if (!coordSettings.windows || !coordSettings.windows.length) {
    coordSettings.windows = [{ date: "2026-09-26", start: "10:00", end: "12:00" }];
  }
  coordBookings.value = data.bookings || [];
  coordSlots.value = data.slots || [];
}

function addCoordWindow() {
  coordSettings.windows.push({ date: "", start: "10:00", end: "12:00" });
}

function removeCoordWindow(index) {
  coordSettings.windows.splice(index, 1);
}

async function saveCoord() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    const data = await api.adminSaveCoord(adminToken.value, { ...coordSettings });
    Object.assign(coordSettings, data.settings || {});
    coordSlots.value = data.slots || [];
    notice.value = t("admin.coordSaved", { n: (data.slots || []).length });
    await loadCoord();
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

async function cancelCoordBooking(item) {
  if (!window.confirm(t("admin.cancelBookQ", { name: item.name, date: item.date, start: item.start }))) return;
  error.value = "";
  notice.value = "";
  try {
    await api.adminCancelCoord(adminToken.value, item.id);
    notice.value = t("admin.cancelled");
    await loadCoord();
  } catch (err) {
    error.value = te(err.message);
  }
}

async function loadJobs() {
  if (!adminToken.value) return;
  const data = await api.adminJobs(adminToken.value);
  jobs.value = data.jobs || [];
  applies.value = data.applies || [];
  jobSettings.adTitle = data.settings.adTitle || "";
  jobSettings.adText = data.settings.adText || "";
  jobSettings.adImage = data.settings.adImage || "";
  jobSettings.cvInboxEmail = data.settings.cvInboxEmail || "msimba@cuhk.edu.cn";
  Object.assign(jobSettings.smtp, data.settings.smtp || {});
}

function startJob(job) {
  moduleId.value = "jobs";
  Object.assign(jobEditor, blankJob(), job || {});
  showPreview.value = false;
  notice.value = "";
  error.value = "";
}

function resetJobEditor() {
  Object.assign(jobEditor, blankJob());
  showPreview.value = false;
}

async function saveJob() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    const data = await api.adminSaveJob(adminToken.value, { ...jobEditor });
    notice.value = t("admin.jobSaved", {
      status: data.job.status === "published" ? t("admin.published") : data.job.status === "closed" ? t("admin.closed") : t("admin.draft"),
    });
    Object.assign(jobEditor, data.job);
    await loadJobs();
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

async function publishJob(id, remind) {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    const data = remind
      ? await api.adminRemindJob(adminToken.value, id)
      : await api.adminPublishJob(adminToken.value, id);
    const mailNote = data.skipped
      ? te(data.skipped)
      : t("admin.tryMail", { n: data.emailed || 0 });
    notice.value = t("admin.notified", {
      verb: remind ? t("admin.verbRemind") : t("admin.verbPublish"),
      n: data.notified || 0,
      mail: mailNote,
    });
    await loadJobs();
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

async function closeJob(id) {
  error.value = "";
  notice.value = "";
  try {
    await api.adminCloseJob(adminToken.value, id);
    notice.value = t("admin.jobClosed");
    await loadJobs();
  } catch (err) {
    error.value = te(err.message);
  }
}

async function deleteJob(job) {
  if (!window.confirm(t("admin.delJobQ", { title: job.title }))) return;
  error.value = "";
  notice.value = "";
  try {
    await api.adminDeleteJob(adminToken.value, job.id);
    if (jobEditor.id === job.id) resetJobEditor();
    notice.value = t("admin.jobDeleted");
    await loadJobs();
  } catch (err) {
    error.value = te(err.message);
  }
}

async function saveJobSettings() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    const data = await api.adminJobsSettings(adminToken.value, {
      adTitle: jobSettings.adTitle,
      adText: jobSettings.adText,
      adImage: jobSettings.adImage,
      cvInboxEmail: jobSettings.cvInboxEmail,
      smtp: jobSettings.smtp,
    });
    Object.assign(jobSettings.smtp, data.smtp || {});
    notice.value = t("admin.jobSetSaved");
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

async function testMail() {
  error.value = "";
  notice.value = "";
  loading.value = true;
  try {
    await api.adminJobsTestMail(adminToken.value, testMailTo.value.trim());
    notice.value = t("admin.testOk");
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

function jobTitleOf(jobId) {
  const job = jobs.value.find((item) => item.id === jobId);
  return job ? job.company + " · " + job.title : jobId;
}

/* ---------- 学生名单维护 ---------- */

const sortedMentors = computed(() =>
  mentors.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
);

const editorTitle = computed(() => (editor.isEdit ? t("admin.editStudent") : t("admin.addStudent")));

function resetEditor() {
  Object.assign(editor, blankStudent());
}

function startEdit(student) {
  moduleId.value = "students";
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
    error.value = t("login.resumePdf");
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
    notice.value = editor.isEdit ? t("admin.updated", { name: editor.name }) : t("admin.created", { name: editor.name });
    resetEditor();
    await load();
  } catch (err) {
    error.value = te(err.message);
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
      ? t("admin.moved", { name: student.name, mentor: (mentorById.value[mentorId] || {}).name })
      : t("admin.removedGroup", { name: student.name });
    await load();
  } catch (err) {
    error.value = te(err.message);
    await load();
  }
}

async function removeStudent(student) {
  if (!window.confirm(t("admin.delStuQ", { name: student.name, sid: student.studentId }))) {
    return;
  }
  error.value = "";
  notice.value = "";
  try {
    await api.adminDeleteStudent(adminToken.value, student.studentId);
    notice.value = t("admin.stuDeleted", { name: student.name });
    await load();
  } catch (err) {
    error.value = te(err.message);
  }
}

async function removeAdminMessage(msg) {
  if (!window.confirm(t("admin.takedownQ"))) return;
  error.value = "";
  notice.value = "";
  try {
    await api.adminDeleteMessage(adminToken.value, msg.id);
    notice.value = t("admin.takedownOk", { name: msg.mentorName || "" });
    await load();
  } catch (err) {
    error.value = te(err.message);
  }
}

async function resetMentorPassword(row) {
  if (!window.confirm(t("admin.resetQ", { name: row.name }))) return;
  error.value = "";
  notice.value = "";
  try {
    const data = await api.adminResetMentorPassword(adminToken.value, row.id);
    notice.value = t("admin.resetOk", { name: row.name, pwd: data.password });
    await load();
  } catch (err) {
    error.value = te(err.message);
  }
}

watch(adminToken, (value) => {
  if (value) load();
});
onMounted(load);
</script>

<template>
  <SiteHero
    :title="t('admin.title')"
    lede=""
  />

  <main class="wrap">
    <section v-if="!adminToken" class="gate">
      <p>{{ t("admin.needLogin") }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>
    </section>

    <template v-else>
      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-if="notice" class="alert ok">{{ notice }}</p>

      <div v-if="!moduleId" class="mods">
        <button
          v-for="item in modules"
          :key="item.id"
          type="button"
          class="mod"
          @click="moduleId = item.id"
        >
          <span class="icon" aria-hidden="true">
            <svg v-if="item.id === 'match'" viewBox="0 0 24 24" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.7" />
              <circle cx="16.5" cy="8.5" r="2.6" stroke="currentColor" stroke-width="1.7" />
              <path d="M3.5 18.5c.6-3 2.6-4.6 4.5-4.6s3.9 1.6 4.5 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <path d="M13.2 18.2c.5-2.4 2.1-3.6 3.4-3.6 1.4 0 3 1.3 3.4 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <svg v-else-if="item.id === 'students'" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="1.7" />
              <path d="M5 19c.7-3.4 3.3-5.2 7-5.2s6.3 1.8 7 5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <svg v-else-if="item.id === 'mentors'" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="6" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.7" />
              <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" stroke="currentColor" stroke-width="1.7" />
              <path d="M3.5 13h17" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <svg v-else-if="item.id === 'messages'" viewBox="0 0 24 24" fill="none">
              <path d="M4.5 6.5h15v9.2a2 2 0 0 1-2 2H9l-4.5 3v-14.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
              <path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <svg v-else-if="item.id === 'jobs'" viewBox="0 0 24 24" fill="none">
              <path d="M8 10V7.8A1.8 1.8 0 0 1 9.8 6h4.4A1.8 1.8 0 0 1 16 7.8V10" stroke="currentColor" stroke-width="1.7" />
              <rect x="3.5" y="9.5" width="17" height="11" rx="2" stroke="currentColor" stroke-width="1.7" />
              <path d="M3.5 13.5h17" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <svg v-else-if="item.id === 'coord'" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7" />
              <path d="M3.5 10h17M8 3.5V7M16 3.5V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <rect x="8" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </button>
      </div>

      <div v-else class="module-bar">
        <button class="btn ghost" type="button" @click="moduleId = ''">{{ t("admin.all") }}</button>
        <strong>{{ (modules.find((m) => m.id === moduleId) || {}).title }}</strong>
        <button class="btn ghost" type="button" @click="logout">{{ t("admin.logout") }}</button>
      </div>

      <section v-if="moduleId === 'match'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.openSettings") }}</h2>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.invite") }}</span>
            <input v-model="config.inviteCode" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.openFrom") }}</span>
            <input v-model="config.openFrom" type="datetime-local" />
          </label>
          <label class="field">
            <span>{{ t("admin.openTo") }}</span>
            <input v-model="config.openTo" type="datetime-local" />
          </label>
          <label class="field">
            <span>{{ t("admin.newPwd") }}</span>
            <input v-model="config.newAdminPassword" type="password" autocomplete="new-password" />
          </label>
        </div>
        <p class="hint">
          {{ t("admin.openHint") }}
        </p>
        <button class="btn" type="button" :disabled="loading" @click="saveConfig">{{ t("admin.save") }}</button>
      </section>

      <section v-if="moduleId === 'match'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.picks") }}</h2>
          <div class="tools">
            <span class="stat">{{ t("admin.pickStat", { n: students.length, picked, resume: resumeTotal }) }}</span>
            <a class="btn ghost" :href="api.adminExportUrl(adminToken)">{{ t("admin.csv") }}</a>
            <a class="btn ghost" :href="api.adminResumesZipUrl(adminToken)">{{ t("admin.zipAll") }}</a>
            <button class="btn ghost" type="button" @click="load">{{ t("admin.refresh") }}</button>
          </div>
        </div>

        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.mentor") }}</th>
              <th>{{ t("admin.org") }}</th>
              <th>{{ t("admin.quota") }}</th>
              <th>{{ t("admin.pickedStudents") }}</th>
              <th>{{ t("admin.groupResume") }}</th>
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
                    {{ s.name }}（{{ s.studentId }}，{{ t("admin.yearTag", { year: s.enrollYear }) }}）
                    <span v-if="s.navigator" class="nav-tag">{{ t("admin.navigator") }}</span>
                    <a
                      v-if="s.resume"
                      :href="api.adminResumeUrl(adminToken, s.studentId)"
                      target="_blank"
                      rel="noopener"
                    >{{ t("admin.resume") }}</a>
                  </li>
                </ul>
              </td>
              <td>
                <a
                  v-if="row.resumeCount"
                  :href="api.adminResumesZipUrl(adminToken, row.id)"
                >{{ t("admin.downloadN", { n: row.resumeCount }) }}</a>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="moduleId === 'students'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.students") }}</h2>
          <span class="stat">{{ t("admin.studentsHint") }}</span>
        </div>

        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.name") }}</th>
              <th>{{ t("admin.sid") }}</th>
              <th>{{ t("admin.year") }}</th>
              <th>{{ t("admin.email") }}</th>
              <th>{{ t("admin.group") }}</th>
              <th>{{ t("admin.actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.studentId">
              <td class="name">
                {{ s.name }}
                <span v-if="s.navigator" class="nav-tag">{{ t("admin.navigator") }}</span>
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
                  <option value="">{{ t("admin.ungrouped") }}</option>
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
                >{{ t("admin.resume") }}</a>
                <span v-else class="muted">{{ t("admin.noResume") }}</span>
                <button type="button" @click="startEdit(s)">{{ t("admin.edit") }}</button>
                <button type="button" class="danger" @click="removeStudent(s)">{{ t("admin.delete") }}</button>
              </td>
            </tr>
            <tr v-if="!students.length">
              <td colspan="6" class="muted">{{ t("admin.noStudents") }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="moduleId === 'students'" class="panel">
        <div class="panel-head">
          <h2>{{ editorTitle }}</h2>
          <button v-if="editor.isEdit" class="btn ghost" type="button" @click="resetEditor">
            {{ t("admin.cancelEdit") }}
          </button>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.sidReq") }}</span>
            <input v-model="editor.studentId" type="text" :disabled="editor.isEdit" />
          </label>
          <label class="field">
            <span>{{ t("admin.nameReq") }}</span>
            <input v-model="editor.name" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.yearReq") }}</span>
            <input v-model="editor.enrollYear" type="text" :placeholder="t('admin.yearPh')" />
          </label>
          <label class="field">
            <span>{{ t("admin.emailReq") }}</span>
            <input v-model="editor.email" type="email" />
          </label>
          <label class="field">
            <span>{{ t("admin.wantNav") }}</span>
            <select v-model="editor.navigator">
              <option :value="false">{{ t("admin.no") }}</option>
              <option :value="true">{{ t("admin.yes") }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t("admin.assign") }}</span>
            <select v-model="editor.mentorId">
              <option value="">{{ t("admin.noAssign") }}</option>
              <option v-for="m in sortedMentors" :key="m.id" :value="m.id">
                {{ m.name }}（{{ counts[m.id] || 0 }}/{{ m.capacity }}）
              </option>
            </select>
          </label>
          <label class="field">
            <span>{{ t("admin.resumePdf") }}{{ editor.isEdit ? t("admin.resumeKeep") : t("admin.resumeReq") }}</span>
            <input type="file" accept="application/pdf" @change="onEditorResume" />
          </label>
        </div>
        <button
          class="btn"
          type="button"
          :disabled="loading || !editor.studentId || !editor.name || !editor.email"
          @click="saveStudent"
        >{{ editor.isEdit ? t("admin.saveEdit") : t("admin.addStudent") }}</button>
      </section>

      <section v-if="moduleId === 'mentors'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.mentorAccounts") }}</h2>
          <span class="stat">{{ t("admin.mentorStat", { n: mentorAccounts.length }) }}</span>
        </div>
        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.mentor") }}</th>
              <th>{{ t("admin.pwdState") }}</th>
              <th>{{ t("admin.lastChange") }}</th>
              <th>{{ t("admin.actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mentorAccounts" :key="row.id">
              <td class="name">{{ row.name }}</td>
              <td :class="{ full: row.usingDefaultPassword }">
                {{ row.usingDefaultPassword ? t("admin.stillDefault") : t("admin.changed") }}
              </td>
              <td class="muted">{{ row.updatedAt ? row.updatedAt.slice(0, 16).replace("T", " ") : "—" }}</td>
              <td class="ops">
                <button type="button" @click="resetMentorPassword(row)">{{ t("admin.resetPwd") }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="moduleId === 'messages'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.msgWatch") }}</h2>
          <div class="tools">
            <span class="stat">{{ t("admin.msgStat", { n: messages.length }) }}</span>
            <select v-model="messageMentor" class="inline-select">
              <option value="">{{ t("admin.allMentors") }}</option>
              <option v-for="m in messageMentors" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
        </div>
        <MessageFeed
          :messages="shownMessages"
          :token="adminToken"
          :empty-text="t('admin.noMentorMsg')"
          deletable
          @remove="removeAdminMessage"
        />
      </section>

      <section v-if="moduleId === 'jobs'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.jobSettings") }}</h2>
          <span class="stat">{{ t("admin.jobSettingsStat") }}</span>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.adTitle") }}</span>
            <input v-model="jobSettings.adTitle" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.cvInbox") }}</span>
            <input v-model="jobSettings.cvInboxEmail" type="email" />
          </label>
          <label class="field" style="grid-column: 1 / -1">
            <span>{{ t("admin.adText") }}</span>
            <textarea v-model="jobSettings.adText" rows="3"></textarea>
          </label>
          <label class="field" style="grid-column: 1 / -1">
            <span>{{ t("admin.adImage") }}</span>
            <input v-model="jobSettings.adImage" type="text" placeholder="https://..." />
          </label>
        </div>
        <h3 class="sub">{{ t("admin.smtp") }}</h3>
        <p class="hint">
          {{ t("admin.smtpHint") }}
          {{ jobSettings.smtp.configured ? t("admin.smtpOn") : t("admin.smtpOff") }}
        </p>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.smtpHost") }}</span>
            <input v-model="jobSettings.smtp.host" type="text" placeholder="smtp.office365.com" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpPort") }}</span>
            <input v-model.number="jobSettings.smtp.port" type="number" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpUser") }}</span>
            <input v-model="jobSettings.smtp.user" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpPass") }}</span>
            <input v-model="jobSettings.smtp.pass" type="password" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpFromName") }}</span>
            <input v-model="jobSettings.smtp.fromName" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpFromEmail") }}</span>
            <input v-model="jobSettings.smtp.fromEmail" type="email" />
          </label>
          <label class="field">
            <span>{{ t("admin.smtpSsl") }}</span>
            <select v-model="jobSettings.smtp.secure">
              <option :value="false">{{ t("admin.smtpNoSsl") }}</option>
              <option :value="true">{{ t("admin.smtpYes") }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t("admin.testTo") }}</span>
            <input v-model="testMailTo" type="email" />
          </label>
        </div>
        <div class="tools">
          <button class="btn" type="button" :disabled="loading" @click="saveJobSettings">{{ t("admin.saveJobs") }}</button>
          <button class="btn ghost" type="button" :disabled="loading" @click="testMail">{{ t("admin.testMail") }}</button>
        </div>
      </section>

      <section v-if="moduleId === 'jobs'" class="panel">
        <div class="panel-head">
          <h2>{{ jobEditor.id ? t("admin.editJob") : t("admin.newJob") }}</h2>
          <button v-if="jobEditor.id" class="btn ghost" type="button" @click="resetJobEditor">{{ t("admin.newJobBtn") }}</button>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.company") }}</span>
            <input v-model="jobEditor.company" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.jobTitle") }}</span>
            <input v-model="jobEditor.title" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.city") }}</span>
            <input v-model="jobEditor.city" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.exp") }}</span>
            <input v-model="jobEditor.experience" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.edu") }}</span>
            <input v-model="jobEditor.education" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.salary") }}</span>
            <input v-model="jobEditor.salary" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.type") }}</span>
            <select v-model="jobEditor.type">
              <option value="fulltime">{{ t("jobs.fulltime") }}</option>
              <option value="intern">{{ t("jobs.intern") }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t("admin.audience") }}</span>
            <input v-model="jobEditor.audience" type="text" :placeholder="t('admin.audiencePh')" />
          </label>
          <label class="field">
            <span>{{ t("admin.jobCv") }}</span>
            <input v-model="jobEditor.cvEmail" type="email" />
          </label>
          <label class="field" style="grid-column: 1 / -1">
            <span>{{ t("admin.jd") }}</span>
            <textarea v-model="jobEditor.description" rows="6"></textarea>
          </label>
        </div>
        <div class="tools">
          <button class="btn ghost" type="button" @click="showPreview = !showPreview">
            {{ showPreview ? t("admin.hidePreview") : t("admin.preview") }}
          </button>
          <button class="btn" type="button" :disabled="loading || !jobEditor.company || !jobEditor.title" @click="saveJob">
            {{ t("admin.saveDraft") }}
          </button>
        </div>
        <div v-if="showPreview" class="preview">
          <JobCard :job="jobEditor" />
        </div>
      </section>

      <section v-if="moduleId === 'jobs'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.jobList") }}</h2>
          <span class="stat">{{ t("admin.nItems", { n: jobs.length }) }}</span>
        </div>
        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.jobCol") }}</th>
              <th>{{ t("admin.type") }}</th>
              <th>{{ t("admin.status") }}</th>
              <th>{{ t("admin.actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id">
              <td>
                <div class="name">{{ job.company }} · {{ job.title }}</div>
                <div class="muted">{{ job.city }} {{ job.salary }}</div>
              </td>
              <td>{{ job.type === "intern" ? t("jobs.intern") : t("jobs.fulltime") }}</td>
              <td>{{ job.status === "published" ? t("admin.published") : job.status === "closed" ? t("admin.closed") : t("admin.draft") }}</td>
              <td class="ops">
                <button type="button" @click="startJob(job)">{{ t("admin.edit") }}</button>
                <button v-if="job.status !== 'published'" type="button" @click="publishJob(job.id, false)">{{ t("admin.publish") }}</button>
                <button v-if="job.status === 'published'" type="button" @click="publishJob(job.id, true)">{{ t("admin.remind") }}</button>
                <button v-if="job.status === 'published'" type="button" @click="closeJob(job.id)">{{ t("admin.close") }}</button>
                <button type="button" class="danger" @click="deleteJob(job)">{{ t("admin.delete") }}</button>
              </td>
            </tr>
            <tr v-if="!jobs.length">
              <td colspan="4" class="muted">{{ t("admin.noJobs") }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="moduleId === 'jobs'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.cvList") }}</h2>
          <span class="stat">{{ t("admin.nFiles", { n: applies.length }) }}</span>
        </div>
        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.student") }}</th>
              <th>{{ t("admin.jobCol") }}</th>
              <th>{{ t("admin.time") }}</th>
              <th>{{ t("admin.mail") }}</th>
              <th>{{ t("admin.actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in applies" :key="item.id">
              <td>
                <div class="name">{{ item.name }}-IMBA{{ item.enrollYear }}</div>
                <div class="muted">{{ item.email }}</div>
                <div v-if="item.note" class="muted">{{ item.note }}</div>
              </td>
              <td>{{ jobTitleOf(item.jobId) }}</td>
              <td class="muted">{{ String(item.createdAt || "").slice(0, 16).replace("T", " ") }}</td>
              <td>{{ item.mailStatus === "sent" ? t("admin.mailSent") : item.mailStatus === "failed" ? t("admin.mailFail") : t("admin.mailSkip") }}</td>
              <td class="ops">
                <a
                  :href="api.adminApplyResumeUrl(adminToken, item.id)"
                  target="_blank"
                  rel="noopener"
                >{{ t("admin.resume") }}</a>
              </td>
            </tr>
            <tr v-if="!applies.length">
              <td colspan="5" class="muted">{{ t("admin.noApply") }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="moduleId === 'coord'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.coordSettings") }}</h2>
          <span class="stat">{{ t("admin.coordSlots", { n: coordSlots.length }) }}</span>
        </div>
        <div class="grid">
          <label class="field">
            <span>{{ t("admin.course") }}</span>
            <input v-model="coordSettings.title" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.interval") }}</span>
            <input v-model.number="coordSettings.intervalMin" type="number" min="5" max="120" />
          </label>
          <label class="field">
            <span>{{ t("admin.openBook") }}</span>
            <select v-model="coordSettings.enabled">
              <option :value="true">{{ t("admin.openYes") }}</option>
              <option :value="false">{{ t("admin.openNo") }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t("admin.zoomId") }}</span>
            <input v-model="coordSettings.zoomId" type="text" />
          </label>
          <label class="field">
            <span>{{ t("admin.zoomPwd") }}</span>
            <input v-model="coordSettings.zoomPassword" type="text" />
          </label>
        </div>
        <h3 class="sub">{{ t("admin.windows") }}</h3>
        <div v-for="(win, index) in coordSettings.windows" :key="index" class="grid">
          <label class="field">
            <span>{{ t("admin.date") }}</span>
            <input v-model="win.date" type="date" />
          </label>
          <label class="field">
            <span>{{ t("admin.start") }}</span>
            <input v-model="win.start" type="time" />
          </label>
          <label class="field">
            <span>{{ t("admin.end") }}</span>
            <input v-model="win.end" type="time" />
          </label>
          <div class="field">
            <span>&nbsp;</span>
            <button class="btn ghost" type="button" @click="removeCoordWindow(index)">{{ t("admin.delDay") }}</button>
          </div>
        </div>
        <div class="tools">
          <button class="btn ghost" type="button" @click="addCoordWindow">{{ t("admin.addDay") }}</button>
          <button class="btn" type="button" :disabled="loading" @click="saveCoord">{{ t("admin.saveCoord") }}</button>
        </div>
      </section>

      <section v-if="moduleId === 'coord'" class="panel">
        <div class="panel-head">
          <h2>{{ t("admin.bookings") }}</h2>
          <span class="stat">{{ t("admin.nPeople", { n: coordBookings.length }) }}</span>
        </div>
        <table class="board">
          <thead>
            <tr>
              <th>{{ t("admin.student") }}</th>
              <th>{{ t("admin.slot") }}</th>
              <th>{{ t("admin.actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in coordBookings" :key="item.id">
              <td class="name">{{ item.name }}-IMBA{{ item.enrollYear }}</td>
              <td>{{ item.date }} {{ item.start }}–{{ item.end }}</td>
              <td class="ops">
                <button type="button" class="danger" @click="cancelCoordBooking(item)">{{ t("match.cancel") }}</button>
              </td>
            </tr>
            <tr v-if="!coordBookings.length">
              <td colspan="3" class="muted">{{ t("admin.noBookings") }}</td>
            </tr>
          </tbody>
        </table>
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
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
}

.inline-select {
  font: inherit;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
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

.grid input[type="file"],
.grid textarea {
  width: 100%;
  font: inherit;
  font-size: 13px;
}

.sub {
  margin: 8px 0 8px;
  font-size: 15px;
}

.preview {
  margin-top: 16px;
}

.mods {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 8px;
}

.mod {
  text-align: left;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 16px;
  padding: 20px 18px 16px;
  box-shadow: var(--shadow);
  cursor: pointer;
  font: inherit;
}

.mod .icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
}

.mod .icon svg { width: 26px; height: 26px; }

.mod h3 { margin: 0 0 6px; font-size: 17px; }
.mod p { margin: 0; font-size: 13px; color: var(--muted); }
.mod:hover { box-shadow: 0 12px 24px rgba(31, 33, 82, 0.12); }
.mod:hover .icon { background: var(--navy); color: #fff; }

.module-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
