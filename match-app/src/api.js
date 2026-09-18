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

  adminLogin: (password) => request("/admin/login", { method: "POST", body: { password } }),
  adminData: (token) => request("/admin/data", { token }),
  adminSaveConfig: (token, payload) =>
    request("/admin/config", { method: "POST", token, body: payload }),
  adminExportUrl: (token) => BASE + "/admin/export.csv?token=" + encodeURIComponent(token),
  adminResumeUrl: (token, studentId) =>
    BASE + "/admin/resume?token=" + encodeURIComponent(token) + "&studentId=" + encodeURIComponent(studentId),
};

export default api;
