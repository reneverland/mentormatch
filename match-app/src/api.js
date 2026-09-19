const BASE = "/api/match";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.message) || "请求失败（" + res.status + "）");
  }
  return data;
}

export const api = {
  state: (token) => request("/state", { token }),
  register: (payload) => request("/register", { method: "POST", body: payload }),
  login: (payload) => request("/login", { method: "POST", body: payload }),
  studentPassword: (token, current, next) =>
    request("/password", { method: "POST", token, body: { current, next } }),
  pick: (token, mentorId) => request("/pick", { method: "POST", token, body: { mentorId } }),
  clearPick: (token) => request("/pick", { method: "POST", token, body: { mentorId: null } }),
  uploadResume: (token, filename, dataBase64) =>
    request("/resume", { method: "POST", token, body: { filename, dataBase64 } }),
  studentResumeUrl: (token) =>
    BASE + "/resume?token=" + encodeURIComponent(token),
  uploadAvatar: (token, filename, dataBase64) =>
    request("/avatar", { method: "POST", token, body: { filename, dataBase64 } }),
  avatarUrl: (token, studentId, version) =>
    BASE + "/avatar?token=" + encodeURIComponent(token) +
    "&studentId=" + encodeURIComponent(studentId || "") +
    (version ? "&v=" + encodeURIComponent(version) : ""),
  imageUrl: (token, file) =>
    BASE + "/image?token=" + encodeURIComponent(token) + "&file=" + encodeURIComponent(file),

  mentorLogin: (mentorId, password) =>
    request("/mentor/login", { method: "POST", body: { mentorId, password } }),
  mentorGroup: (token) => request("/mentor/group", { token }),
  mentorPassword: (token, current, next) =>
    request("/mentor/password", { method: "POST", token, body: { current, next } }),
  mentorBroadcast: (token, text, images) =>
    request("/mentor/broadcast", { method: "POST", token, body: { text, images } }),
  mentorDeleteMessage: (token, id) =>
    request("/mentor/message/delete", { method: "POST", token, body: { id } }),
  mentorResumeUrl: (token, studentId) =>
    BASE + "/mentor/resume?token=" + encodeURIComponent(token) +
    "&studentId=" + encodeURIComponent(studentId),

  adminLogin: (password) => request("/admin/login", { method: "POST", body: { password } }),
  adminData: (token) => request("/admin/data", { token }),
  adminSaveConfig: (token, payload) =>
    request("/admin/config", { method: "POST", token, body: payload }),
  adminSaveStudent: (token, payload) =>
    request("/admin/student", { method: "POST", token, body: payload }),
  adminAssign: (token, studentId, mentorId) =>
    request("/admin/assign", { method: "POST", token, body: { studentId, mentorId } }),
  adminDeleteStudent: (token, studentId) =>
    request("/admin/delete", { method: "POST", token, body: { studentId } }),
  adminResetMentorPassword: (token, mentorId) =>
    request("/admin/mentor-password", { method: "POST", token, body: { mentorId } }),
  adminExportUrl: (token) => BASE + "/admin/export.csv?token=" + encodeURIComponent(token),
  adminResumeUrl: (token, studentId) =>
    BASE + "/admin/resume?token=" + encodeURIComponent(token) + "&studentId=" + encodeURIComponent(studentId),
  adminResumesZipUrl: (token, mentorId) =>
    BASE + "/admin/resumes.zip?token=" + encodeURIComponent(token) +
    (mentorId ? "&mentorId=" + encodeURIComponent(mentorId) : ""),
  adminDeleteMessage: (token, id) =>
    request("/admin/message/delete", { method: "POST", token, body: { id } }),

  jobs: (token) => request("/jobs", { token }),
  jobDetail: (id) => request("/jobs/" + encodeURIComponent(id)),
  jobApply: (token, id, note) =>
    request("/jobs/" + encodeURIComponent(id) + "/apply", { method: "POST", token, body: { note } }),
  inbox: (token) => request("/inbox", { token }),
  inboxRead: (token, ids) => request("/inbox/read", { method: "POST", token, body: { ids } }),
  inboxDm: (token, toStudentId, body) =>
    request("/inbox/dm", { method: "POST", token, body: { toStudentId, body } }),
  presence: (token) => request("/presence", { token }),
  heartbeat: (token) => request("/presence/heartbeat", { method: "POST", token, body: {} }),

  adminJobs: (token) => request("/admin/jobs", { token }),
  adminSaveJob: (token, payload) => request("/admin/jobs", { method: "POST", token, body: payload }),
  adminPublishJob: (token, id) => request("/admin/jobs/publish", { method: "POST", token, body: { id } }),
  adminRemindJob: (token, id) => request("/admin/jobs/remind", { method: "POST", token, body: { id } }),
  adminCloseJob: (token, id) => request("/admin/jobs/close", { method: "POST", token, body: { id } }),
  adminDeleteJob: (token, id) => request("/admin/jobs/delete", { method: "POST", token, body: { id } }),
  adminJobsSettings: (token, payload) =>
    request("/admin/jobs-settings", { method: "POST", token, body: payload }),
  adminJobsTestMail: (token, to) =>
    request("/admin/jobs-settings/test", { method: "POST", token, body: { to } }),
  adminApplyResumeUrl: (token, applyId) =>
    BASE + "/admin/jobs/apply-resume?token=" + encodeURIComponent(token) +
    "&applyId=" + encodeURIComponent(applyId),

  coord: (token) => request("/coord", { token }),
  coordBook: (token, date, start) =>
    request("/coord/book", { method: "POST", token, body: { date, start } }),
  coordCancel: (token) => request("/coord/cancel", { method: "POST", token, body: {} }),
  adminCoord: (token) => request("/admin/coord", { token }),
  adminSaveCoord: (token, payload) => request("/admin/coord", { method: "POST", token, body: payload }),
  adminCancelCoord: (token, id) =>
    request("/admin/coord/cancel", { method: "POST", token, body: { id } }),
};

export default api;
