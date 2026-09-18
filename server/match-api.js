const fs = require("fs");
const store = require("./match-store");

const PREFIX = "/api/match";
const MAX_BODY = 12 * 1024 * 1024; // 简历以 base64 内嵌，留出余量
const STUDENT_ID_RE = /^[A-Za-z0-9_-]{4,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function fail(res, code, message) {
  sendJson(res, code, { message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("上传内容过大。"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(new Error("请求格式不正确。"));
      }
    });
    req.on("error", reject);
  });
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function sameCode(given, expected) {
  return String(given || "").trim().toLowerCase() === String(expected || "").trim().toLowerCase();
}

function publicStudent(student, picks) {
  return {
    studentId: student.studentId,
    name: student.name,
    enrollYear: student.enrollYear,
    email: student.email,
    navigator: student.navigator,
    resume: Boolean(student.resume),
    mentorId: picks[student.studentId] || "",
  };
}

function currentStudent(req) {
  const studentId = store.readStudentToken(bearer(req));
  if (!studentId) return null;
  return store.getStudents().find((s) => s.studentId === studentId) || null;
}

function windowState(config) {
  return {
    open: store.isOpen(config),
    openFrom: config.openFrom || "",
    openTo: config.openTo || "",
  };
}

function handleState(req, res) {
  const config = store.getConfig();
  const student = currentStudent(req);
  sendJson(res, 200, {
    window: windowState(config),
    counts: store.countsByMentor(),
    me: student ? publicStudent(student, store.getPicks()) : null,
  });
}

async function handleRegister(req, res) {
  const body = await readBody(req);
  const config = store.getConfig();

  if (!sameCode(body.inviteCode, config.inviteCode)) {
    return fail(res, 403, "邀请码不正确，请向项目组确认。");
  }

  const studentId = String(body.studentId || "").trim();
  const name = String(body.name || "").trim();
  const enrollYear = String(body.enrollYear || "").trim();
  const email = String(body.email || "").trim();

  if (!STUDENT_ID_RE.test(studentId)) return fail(res, 400, "学号格式不正确（4-32 位字母或数字）。");
  if (!name) return fail(res, 400, "请填写姓名。");
  if (!/^\d{4}$/.test(enrollYear)) return fail(res, 400, "请选择入学年份。");
  if (!EMAIL_RE.test(email)) return fail(res, 400, "邮箱格式不正确。");
  if (typeof body.navigator !== "boolean") return fail(res, 400, "请选择是否愿意担任领航员。");

  const students = store.getStudents();
  if (students.some((s) => s.studentId === studentId)) {
    return fail(res, 409, "该学号已注册，请用「已注册 · 再次进入」。");
  }

  const student = {
    studentId,
    name,
    enrollYear,
    email,
    navigator: body.navigator,
    resume: "",
    createdAt: new Date().toISOString(),
  };
  students.push(student);
  store.saveStudents(students);

  sendJson(res, 200, {
    token: store.issueStudentToken(studentId),
    me: publicStudent(student, store.getPicks()),
  });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const config = store.getConfig();

  if (!sameCode(body.inviteCode, config.inviteCode)) {
    return fail(res, 403, "邀请码不正确，请向项目组确认。");
  }

  const studentId = String(body.studentId || "").trim();
  const student = store.getStudents().find((s) => s.studentId === studentId);
  if (!student) return fail(res, 404, "该学号还没有注册，请先完成注册。");

  sendJson(res, 200, {
    token: store.issueStudentToken(studentId),
    me: publicStudent(student, store.getPicks()),
  });
}

async function handlePick(req, res) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "登录状态已失效，请重新进入。");

  const config = store.getConfig();
  if (!store.isOpen(config)) return fail(res, 403, "当前不在选择开放时间内。");

  const body = await readBody(req);
  const mentorId = body.mentorId === null ? "" : String(body.mentorId || "").trim();

  // Node 单线程，下面这段读改写不会被其他请求打断，名额判断与落盘是一体的。
  const picks = store.getPicks();
  const previous = picks[student.studentId] || "";

  if (mentorId) {
    const mentor = store.getMentors().find((m) => m.id === mentorId);
    if (!mentor) return fail(res, 404, "导师不存在。");
    if (mentorId !== previous) {
      let taken = 0;
      Object.keys(picks).forEach((key) => {
        if (picks[key] === mentorId) taken += 1;
      });
      if (taken >= mentor.capacity) {
        return fail(res, 409, mentor.name + " 的名额已被选满，请选择其他导师。");
      }
    }
    picks[student.studentId] = mentorId;
  } else {
    delete picks[student.studentId];
  }
  store.savePicks(picks);

  sendJson(res, 200, {
    counts: store.countsByMentor(),
    me: publicStudent(student, picks),
  });
}

async function handleResume(req, res) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "登录状态已失效，请重新进入。");

  const body = await readBody(req);
  const base64 = String(body.dataBase64 || "");
  if (!base64) return fail(res, 400, "没有收到简历文件。");

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 8 * 1024 * 1024) return fail(res, 413, "简历请控制在 8MB 以内。");
  if (buffer.slice(0, 4).toString("latin1") !== "%PDF") return fail(res, 400, "简历必须是 PDF 文件。");

  const target = store.resumePath(student.studentId);
  if (!target) return fail(res, 400, "学号不合法。");
  fs.writeFileSync(target, buffer);

  const students = store.getStudents();
  const record = students.find((s) => s.studentId === student.studentId);
  if (record) {
    record.resume = String(body.filename || "").trim() || student.studentId + ".pdf";
    store.saveStudents(students);
  }

  sendJson(res, 200, { ok: true });
}

async function handleAdminLogin(req, res) {
  const body = await readBody(req);
  if (!store.checkAdminPassword(body.password)) return fail(res, 403, "管理员密码不正确。");
  sendJson(res, 200, { token: store.issueAdminToken() });
}

function handleAdminData(req, res) {
  const config = store.getConfig();
  const picks = store.getPicks();
  sendJson(res, 200, {
    config: {
      inviteCode: config.inviteCode,
      openFrom: config.openFrom || "",
      openTo: config.openTo || "",
    },
    window: windowState(config),
    counts: store.countsByMentor(),
    students: store.getStudents().map((s) => publicStudent(s, picks)),
  });
}

async function handleAdminConfig(req, res) {
  const body = await readBody(req);
  const config = store.getConfig();

  const inviteCode = String(body.inviteCode || "").trim();
  if (!inviteCode) return fail(res, 400, "邀请码不能为空。");
  config.inviteCode = inviteCode;
  config.openFrom = String(body.openFrom || "").trim();
  config.openTo = String(body.openTo || "").trim();

  if (config.openFrom && config.openTo && new Date(config.openFrom) > new Date(config.openTo)) {
    return fail(res, 400, "开始时间不能晚于结束时间。");
  }
  store.saveConfig(config);

  if (body.newAdminPassword) {
    if (String(body.newAdminPassword).length < 6) return fail(res, 400, "新密码至少 6 位。");
    store.setAdminPassword(String(body.newAdminPassword));
  }

  sendJson(res, 200, { ok: true });
}

function handleAdminExport(res) {
  const picks = store.getPicks();
  const mentors = store.getMentors();
  const nameOf = {};
  mentors.forEach((m) => { nameOf[m.id] = m.name; });

  const header = ["学号", "姓名", "入学年份", "邮箱", "愿任领航员", "所选导师", "简历", "注册时间"];
  const lines = [header];
  store.getStudents().forEach((s) => {
    lines.push([
      s.studentId,
      s.name,
      s.enrollYear,
      s.email,
      s.navigator ? "是" : "否",
      nameOf[picks[s.studentId]] || "",
      s.resume || "",
      s.createdAt || "",
    ]);
  });

  const csv = lines
    .map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","))
    .join("\r\n");
  const body = Buffer.concat([Buffer.from("\uFEFF", "utf8"), Buffer.from(csv, "utf8")]);

  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Length": body.length,
    "Content-Disposition": 'attachment; filename="mentor-match.csv"',
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function handleAdminResume(res, studentId) {
  const student = store.getStudents().find((s) => s.studentId === studentId);
  const file = student ? store.resumePath(studentId) : "";
  if (!file || !fs.existsSync(file)) return fail(res, 404, "没有找到该学生的简历。");

  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Length": stat.size,
    "Content-Disposition":
      "inline; filename*=UTF-8''" + encodeURIComponent(student.resume || studentId + ".pdf"),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

// 返回 true 表示请求已由匹配模块处理，静态服务不再介入。
async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  if (!route.startsWith(PREFIX)) return false;

  const tail = route.slice(PREFIX.length);
  const method = req.method;

  try {
    if (tail === "/state" && method === "GET") return handleState(req, res), true;
    if (tail === "/register" && method === "POST") return await handleRegister(req, res), true;
    if (tail === "/login" && method === "POST") return await handleLogin(req, res), true;
    if (tail === "/pick" && method === "POST") return await handlePick(req, res), true;
    if (tail === "/resume" && method === "POST") return await handleResume(req, res), true;
    if (tail === "/admin/login" && method === "POST") return await handleAdminLogin(req, res), true;

    if (tail.startsWith("/admin/")) {
      const token = bearer(req) || url.searchParams.get("token") || "";
      if (!store.isAdminToken(token)) {
        fail(res, 401, "管理员登录已失效，请重新登录。");
        return true;
      }
      if (tail === "/admin/data" && method === "GET") return handleAdminData(req, res), true;
      if (tail === "/admin/config" && method === "POST") return await handleAdminConfig(req, res), true;
      if (tail === "/admin/export.csv" && method === "GET") return handleAdminExport(res), true;
      if (tail === "/admin/resume" && method === "GET") {
        return handleAdminResume(res, url.searchParams.get("studentId") || ""), true;
      }
    }

    fail(res, 404, "接口不存在。");
    return true;
  } catch (err) {
    fail(res, 400, err.message || "请求处理失败。");
    return true;
  }
}

module.exports = { handle, PREFIX };
