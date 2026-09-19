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
  pick: (token, mentorId) => request("/pick", { method: "POST", token, body: { mentorId } }),
  clearPick: (token) => request("/pick", { method: "POST", token, body: { mentorId: null } }),
  uploadResume: (token, filename, dataBase64) =>
    request("/resume", { method: "POST", token, body: { filename, dataBase64 } }),
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
};

export default api;
