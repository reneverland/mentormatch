const fs = require("fs");
const store = require("./match-store");
const { zipStore } = require("./match-zip");
const jobsApi = require("./match-jobs");
const coordApi = require("./match-coord");
const notify = require("./notify-mail");
const { SITE } = require("./mail-templates");

const PREFIX = "/api/match";
const MAX_BODY = 24 * 1024 * 1024; // 简历与群发图片都以 base64 内嵌，留出余量
const STUDENT_ID_RE = /^[A-Za-z0-9_-]{4,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES_PER_MESSAGE = 4;

const IMAGE_TYPES = [
  { ext: ".jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: ".png",
    mime: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: ".webp",
    mime: "image/webp",
    test: (b) => b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP",
  },
];

function detectImage(buffer) {
  if (buffer.length < 12) return null;
  return IMAGE_TYPES.find((type) => type.test(buffer)) || null;
}

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
    resumeName: student.resume || "",
    mentorId: picks[student.studentId] || "",
    passwordDefault: Boolean(student.passwordDefault),
    avatar: Boolean(student.avatar),
    avatarAt: student.avatarUpdatedAt || "",
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

// 开放后罗世翔名额用虚拟学生占满，不写入 students/picks，避免污染导出。
const AUTO_FILL_MENTOR_ID = "m19";
const AUTO_FILL_NAMES = ["林启航", "周予安"];

function autoFillOn() {
  return store.isOpen(store.getConfig());
}

function extraTaken(mentor, realTaken) {
  if (!mentor || mentor.id !== AUTO_FILL_MENTOR_ID || !autoFillOn()) return 0;
  return Math.max(mentor.capacity - realTaken, 0);
}

function virtualStudents(mentor, realTaken) {
  const extra = extraTaken(mentor, realTaken);
  if (!extra) return [];
  return AUTO_FILL_NAMES.slice(0, extra).map((name, index) => ({
    studentId: "22603890" + String(index + 1),
    name,
    enrollYear: "2026",
    email: "—",
    navigator: false,
    resume: false,
    mentorId: mentor.id,
  }));
}

// 学生端只拿到档位，拿不到每位导师的精确已选人数。
function bandsByMentor() {
  const counts = store.countsByMentor();
  const bands = {};
  store.getMentors().forEach((mentor) => {
    const real = counts[mentor.id] || 0;
    const remaining = Math.max(mentor.capacity - real - extraTaken(mentor, real), 0);
    // 石仁达只改学生端展示，总分档与选导规则不动；选满仍走「名额已满」。
    if (mentor.id === "m09" && remaining > 0) {
      bands[mentor.id] = { key: "tight", label: "名额紧张" };
    } else {
      bands[mentor.id] = store.remainingBand(remaining);
    }
  });
  return bands;
}

function messagesForMentor(mentorId) {
  return store
    .getMessages()
    .filter((msg) => msg.mentorId === mentorId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function writeResume(studentId, filename, base64) {
  const buffer = Buffer.from(String(base64 || ""), "base64");
  if (!buffer.length) throw new Error("没有收到简历文件。");
  if (buffer.length > MAX_RESUME_BYTES) throw new Error("简历请控制在 8MB 以内。");
  if (buffer.slice(0, 4).toString("latin1") !== "%PDF") throw new Error("简历必须是 PDF 文件。");

  const target = store.resumePath(studentId);
  if (!target) throw new Error("学号不合法。");
  fs.writeFileSync(target, buffer);
  return String(filename || "").trim() || studentId + ".pdf";
}

function handleState(req, res) {
  const config = store.getConfig();
  const student = currentStudent(req);
  const picks = store.getPicks();
  const me = student ? publicStudent(student, picks) : null;
  sendJson(res, 200, {
    window: windowState(config),
    bands: bandsByMentor(),
    me,
    messages: me && me.mentorId ? messagesForMentor(me.mentorId) : [],
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
  if (!body.resumeBase64) return fail(res, 400, "请上传 PDF 简历，注册时为必填项。");

  const students = store.getStudents();
  if (students.some((s) => s.studentId === studentId)) {
    return fail(res, 409, "该学号已注册，请用「已注册 · 再次进入」。");
  }

  const resume = writeResume(studentId, body.resumeFilename, body.resumeBase64);

  const student = {
    studentId,
    name,
    enrollYear,
    email,
    navigator: body.navigator,
    resume,
    createdAt: new Date().toISOString(),
  };
  store.applyStudentPassword(student, store.DEFAULT_STUDENT_PASSWORD, true);
  students.push(student);
  store.saveStudents(students);

  const inbox = store.getInbox();
  store.getJobs()
    .filter((job) => job.status === "published")
    .forEach((job) => {
      inbox.push({
        id: store.newInboxId(),
        type: "job",
        toStudentId: studentId,
        fromStudentId: "",
        fromName: "招聘发布",
        title: "在招：" + job.company + " · " + job.title,
        body: job.company + " 正在招聘 " + job.title + "（" + job.salary + "）。请到招聘页查看并投递。",
        jobId: job.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
  store.saveInbox(inbox);

  await notify.sendTemplate(email, "register", { name });
  await notify.sendAdmin("admin-event", {
    subject: "新学生注册：" + name,
    title: "新学生注册",
    paragraphs: [
      name + "（学号 " + studentId + "）已完成平台注册。",
      "邮箱：" + email,
    ],
    buttonLabel: "打开管理后台",
    buttonUrl: SITE + "/admin",
  });

  sendJson(res, 200, {
    token: store.issueStudentToken(studentId),
    me: publicStudent(student, store.getPicks()),
  });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const studentId = String(body.studentId || "").trim();
  const students = store.getStudents();
  const student = students.find((s) => s.studentId === studentId);
  if (!student) return fail(res, 404, "该学号还没有注册，请先完成注册。");
  if (store.ensureStudentPassword(student)) store.saveStudents(students);
  if (!store.checkStudentPassword(student, body.password)) {
    return fail(res, 403, "密码不正确，如未改过密码请使用初始密码 imba666。");
  }

  sendJson(res, 200, {
    token: store.issueStudentToken(studentId),
    me: publicStudent(student, store.getPicks()),
  });
}

async function handleStudentPassword(req, res) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "登录状态已失效，请重新进入。");
  const body = await readBody(req);
  if (!store.checkStudentPassword(student, body.current)) {
    return fail(res, 403, "当前密码不正确。");
  }
  const next = String(body.next || "");
  if (next.length < 6) return fail(res, 400, "新密码至少 6 位。");
  store.setStudentPassword(student.studentId, next, next === store.DEFAULT_STUDENT_PASSWORD);
  sendJson(res, 200, { token: store.issueStudentToken(student.studentId) });
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
      taken += extraTaken(mentor, taken);
      if (taken >= mentor.capacity) {
        return fail(res, 409, mentor.name + " 的名额已被选满，请选择其他导师。");
      }
    }
    picks[student.studentId] = mentorId;
  } else {
    delete picks[student.studentId];
  }
  store.savePicks(picks);

  const me = publicStudent(student, picks);
  sendJson(res, 200, {
    bands: bandsByMentor(),
    me,
    messages: me.mentorId ? messagesForMentor(me.mentorId) : [],
  });
}

async function handleResume(req, res) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "登录状态已失效，请重新进入。");

  const body = await readBody(req);
  const resume = writeResume(student.studentId, body.filename, body.dataBase64);

  const students = store.getStudents();
  const record = students.find((s) => s.studentId === student.studentId);
  if (record) {
    record.resume = resume;
    store.saveStudents(students);
  }

  sendJson(res, 200, { ok: true, me: publicStudent(record || student, store.getPicks()) });
}

async function handleAvatarUpload(req, res) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "登录状态已失效，请重新进入。");

  const body = await readBody(req);
  const buffer = Buffer.from(String(body.dataBase64 || ""), "base64");
  if (!buffer.length) return fail(res, 400, "没有收到头像文件。");
  if (buffer.length > MAX_AVATAR_BYTES) return fail(res, 413, "头像请控制在 3MB 以内。");
  const type = detectImage(buffer);
  if (!type) return fail(res, 400, "头像仅支持 jpg / png / webp。");

  const ext = type.ext.replace(".", "");
  store.clearAvatarFiles(student.studentId);
  const target = store.avatarPath(student.studentId, ext);
  if (!target) return fail(res, 400, "学号不合法。");
  fs.writeFileSync(target, buffer);

  const students = store.getStudents();
  const record = students.find((s) => s.studentId === student.studentId);
  if (record) {
    record.avatar = ext;
    record.avatarUpdatedAt = new Date().toISOString();
    store.saveStudents(students);
  }

  const next = record || student;
  sendJson(res, 200, { ok: true, me: publicStudent(next, store.getPicks()) });
}

function handleAvatarGet(req, res, url) {
  const token = bearer(req) || url.searchParams.get("token") || "";
  const viewerId = store.readStudentToken(token);
  if (!viewerId && !store.isAdminToken(token) && !store.readMentorToken(token)) {
    return fail(res, 401, "请先登录。");
  }

  const studentId = String(url.searchParams.get("studentId") || viewerId || "").trim();
  const student = store.getStudents().find((s) => s.studentId === studentId);
  const file = store.avatarFile(student);
  if (!file) return fail(res, 404, "还没有上传头像。");

  const type = IMAGE_TYPES.find((item) => file.endsWith(item.ext)) || { mime: "application/octet-stream" };
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": type.mime,
    "Content-Length": stat.size,
    "Cache-Control": "private, max-age=3600",
  });
  fs.createReadStream(file).pipe(res);
}

/* ---------- 导师端 ---------- */

function currentMentor(req, url) {
  const token = bearer(req) || (url ? url.searchParams.get("token") : "") || "";
  const mentorId = store.readMentorToken(token);
  if (!mentorId) return null;
  return store.getMentors().find((m) => m.id === mentorId) || null;
}

function mentorProfile(mentor) {
  const account = store.getMentorAccounts()[mentor.id] || {};
  return {
    id: mentor.id,
    name: mentor.name,
    capacity: mentor.capacity,
    usingDefaultPassword: Boolean(account.isDefault),
  };
}

function groupStudents(mentorId) {
  const picks = store.getPicks();
  return store
    .getStudents()
    .filter((s) => picks[s.studentId] === mentorId)
    .map((s) => publicStudent(s, picks));
}

async function handleMentorLogin(req, res) {
  const body = await readBody(req);
  const mentorId = String(body.mentorId || "").trim();
  const mentor = store.getMentors().find((m) => m.id === mentorId);
  if (!mentor) return fail(res, 404, "请选择导师姓名。");
  if (!store.checkMentorPassword(mentorId, body.password)) {
    return fail(res, 403, "密码不正确，如未改过密码请使用项目组下发的初始密码。");
  }
  sendJson(res, 200, {
    token: store.issueMentorToken(mentorId),
    mentor: mentorProfile(mentor),
  });
}

function handleMentorGroup(req, res, url) {
  const mentor = currentMentor(req, url);
  if (!mentor) return fail(res, 401, "导师登录已失效，请重新登录。");
  const students = groupStudents(mentor.id);
  const extra = virtualStudents(mentor, students.length);
  const all = students.concat(extra);
  sendJson(res, 200, {
    mentor: mentorProfile(mentor),
    students: all,
    taken: all.length,
    remaining: Math.max(mentor.capacity - all.length, 0),
    messages: messagesForMentor(mentor.id),
  });
}

async function handleMentorPassword(req, res) {
  const mentor = currentMentor(req, null);
  if (!mentor) return fail(res, 401, "导师登录已失效，请重新登录。");

  const body = await readBody(req);
  if (!store.checkMentorPassword(mentor.id, body.current)) {
    return fail(res, 403, "当前密码不正确。");
  }
  const next = String(body.next || "");
  if (next.length < 8) return fail(res, 400, "新密码至少 8 位。");
  if (next === store.DEFAULT_MENTOR_PASSWORD) return fail(res, 400, "新密码不能与初始密码相同。");
  store.setMentorPassword(mentor.id, next, false);

  // 改密会让旧令牌失效，直接换一枚新的回去，导师不用重新登录。
  sendJson(res, 200, { token: store.issueMentorToken(mentor.id) });
}

async function handleMentorBroadcast(req, res) {
  const mentor = currentMentor(req, null);
  if (!mentor) return fail(res, 401, "导师登录已失效，请重新登录。");

  const body = await readBody(req);
  const text = String(body.text || "").trim();
  const incoming = Array.isArray(body.images) ? body.images : [];
  if (!text && !incoming.length) return fail(res, 400, "请写点内容或至少上传一张图片。");
  if (text.length > 2000) return fail(res, 400, "文字请控制在 2000 字以内。");
  if (incoming.length > MAX_IMAGES_PER_MESSAGE) {
    return fail(res, 400, "一条消息最多 " + MAX_IMAGES_PER_MESSAGE + " 张图片。");
  }

  const messageId = store.newMessageId();
  const images = [];
  for (let i = 0; i < incoming.length; i += 1) {
    const buffer = Buffer.from(String(incoming[i].dataBase64 || ""), "base64");
    if (!buffer.length) return fail(res, 400, "第 " + (i + 1) + " 张图片读取失败。");
    if (buffer.length > MAX_IMAGE_BYTES) return fail(res, 413, "单张图片请控制在 2MB 以内。");
    const type = detectImage(buffer);
    if (!type) return fail(res, 400, "图片仅支持 jpg / png / webp。");

    const name = messageId + "-" + (i + 1) + type.ext;
    const target = store.messageImagePath(name);
    if (!target) return fail(res, 400, "图片名不合法。");
    fs.writeFileSync(target, buffer);
    images.push(name);
  }

  const messages = store.getMessages();
  messages.push({
    id: messageId,
    mentorId: mentor.id,
    mentorName: mentor.name,
    text,
    images,
    createdAt: new Date().toISOString(),
  });
  store.saveMessages(messages);

  await notify.sendMany(groupStudents(mentor.id), "mentor-broadcast", () => ({
    mentorName: mentor.name,
    text,
    hasImages: images.length > 0,
  }));
  await notify.sendAdmin("admin-event", {
    subject: "导师发布：" + mentor.name,
    title: "导师发布信息",
    paragraphs: [
      mentor.name + " 向本组发布了一条通知。",
      text || "（含图片，请到平台查看）",
      images.length ? "通知含 " + images.length + " 张图片。" : "",
    ].filter(Boolean),
    buttonLabel: "打开导师匹配",
    buttonUrl: SITE + "/match",
  });

  sendJson(res, 200, { messages: messagesForMentor(mentor.id) });
}

function removeMessageById(id, mentorId) {
  const messages = store.getMessages();
  const target = messages.find((m) => m.id === id && (!mentorId || m.mentorId === mentorId));
  if (!target) return null;
  (target.images || []).forEach((name) => {
    const file = store.messageImagePath(name);
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });
  store.saveMessages(messages.filter((m) => m !== target));
  return target;
}

async function handleMentorDeleteMessage(req, res) {
  const mentor = currentMentor(req, null);
  if (!mentor) return fail(res, 401, "导师登录已失效，请重新登录。");

  const body = await readBody(req);
  const target = removeMessageById(String(body.id || ""), mentor.id);
  if (!target) return fail(res, 404, "没有找到这条消息。");

  sendJson(res, 200, { messages: messagesForMentor(mentor.id) });
}

async function handleAdminDeleteMessage(req, res) {
  const body = await readBody(req);
  const target = removeMessageById(String(body.id || ""), "");
  if (!target) return fail(res, 404, "没有找到这条消息。");
  sendJson(res, 200, { ok: true });
}

function handleMentorResume(req, res, url) {
  const mentor = currentMentor(req, url);
  if (!mentor) return fail(res, 401, "导师登录已失效，请重新登录。");

  const studentId = url.searchParams.get("studentId") || "";
  if (store.getPicks()[studentId] !== mentor.id) {
    return fail(res, 403, "只能查看本组学生的简历。");
  }
  sendResume(res, studentId);
}

// 图片对三类身份开放：本组学生、发帖导师、管理员。
function handleMessageImage(req, res, url) {
  const name = url.searchParams.get("file") || "";
  const message = store.getMessages().find((m) => (m.images || []).indexOf(name) !== -1);
  if (!message) return fail(res, 404, "图片不存在。");

  const token = bearer(req) || url.searchParams.get("token") || "";
  const studentId = store.readStudentToken(token);
  const allowed =
    store.isAdminToken(token) ||
    store.readMentorToken(token) === message.mentorId ||
    (studentId && store.getPicks()[studentId] === message.mentorId);
  if (!allowed) return fail(res, 403, "没有权限查看这张图片。");

  const file = store.messageImagePath(name);
  if (!file || !fs.existsSync(file)) return fail(res, 404, "图片不存在。");
  const type = IMAGE_TYPES.find((t) => name.endsWith(t.ext));
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": type ? type.mime : "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "private, max-age=86400",
  });
  fs.createReadStream(file).pipe(res);
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
    mentorAccounts: store
      .getMentors()
      .map((m) => {
        const account = store.getMentorAccounts()[m.id] || {};
        return {
          id: m.id,
          name: m.name,
          usingDefaultPassword: Boolean(account.isDefault),
          updatedAt: account.updatedAt || "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    messages: store.getMessages().slice().sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    ),
  });
}

// 管理员调组不看开放时间，但名额上限照样拦。
function assignMentor(picks, studentId, mentorId) {
  if (!mentorId) {
    delete picks[studentId];
    return "";
  }
  const mentor = store.getMentors().find((m) => m.id === mentorId);
  if (!mentor) return "导师不存在。";
  if (picks[studentId] !== mentorId) {
    const taken = Object.keys(picks).filter((key) => picks[key] === mentorId).length;
    if (taken + extraTaken(mentor, taken) >= mentor.capacity) {
      return mentor.name + " 的名额已满，无法再加入学生。";
    }
  }
  picks[studentId] = mentorId;
  return "";
}

async function handleAdminStudent(req, res) {
  const body = await readBody(req);
  const studentId = String(body.studentId || "").trim();
  const name = String(body.name || "").trim();
  const enrollYear = String(body.enrollYear || "").trim();
  const email = String(body.email || "").trim();

  if (!STUDENT_ID_RE.test(studentId)) return fail(res, 400, "学号格式不正确（4-32 位字母或数字）。");
  if (!name) return fail(res, 400, "请填写姓名。");
  if (!/^\d{4}$/.test(enrollYear)) return fail(res, 400, "请填写入学年份。");
  if (!EMAIL_RE.test(email)) return fail(res, 400, "邮箱格式不正确。");

  const students = store.getStudents();
  const existing = students.find((s) => s.studentId === studentId);
  if (!existing && !body.resumeBase64) return fail(res, 400, "新增学生必须上传 PDF 简历。");

  let resume = existing ? existing.resume : "";
  if (body.resumeBase64) resume = writeResume(studentId, body.resumeFilename, body.resumeBase64);

  if (existing) {
    existing.name = name;
    existing.enrollYear = enrollYear;
    existing.email = email;
    existing.navigator = Boolean(body.navigator);
    existing.resume = resume;
  } else {
    const created = {
      studentId,
      name,
      enrollYear,
      email,
      navigator: Boolean(body.navigator),
      resume,
      createdAt: new Date().toISOString(),
      createdBy: "admin",
    };
    store.applyStudentPassword(created, store.DEFAULT_STUDENT_PASSWORD, true);
    students.push(created);
  }

  const picks = store.getPicks();
  const mentorId = String(body.mentorId || "").trim();
  if (mentorId || body.mentorId === "") {
    const problem = assignMentor(picks, studentId, mentorId);
    if (problem) return fail(res, 409, problem);
  }

  store.saveStudents(students);
  store.savePicks(picks);
  sendJson(res, 200, { ok: true });
}

async function handleAdminAssign(req, res) {
  const body = await readBody(req);
  const studentId = String(body.studentId || "").trim();
  if (!store.getStudents().some((s) => s.studentId === studentId)) {
    return fail(res, 404, "没有找到该学生。");
  }

  const picks = store.getPicks();
  const problem = assignMentor(picks, studentId, String(body.mentorId || "").trim());
  if (problem) return fail(res, 409, problem);
  store.savePicks(picks);

  sendJson(res, 200, { ok: true });
}

async function handleAdminDelete(req, res) {
  const body = await readBody(req);
  const studentId = String(body.studentId || "").trim();
  const students = store.getStudents();
  if (!students.some((s) => s.studentId === studentId)) {
    return fail(res, 404, "没有找到该学生。");
  }

  const file = store.resumePath(studentId);
  if (file && fs.existsSync(file)) fs.unlinkSync(file);
  store.clearAvatarFiles(studentId);

  const picks = store.getPicks();
  delete picks[studentId];
  store.savePicks(picks);
  store.saveStudents(students.filter((s) => s.studentId !== studentId));

  sendJson(res, 200, { ok: true });
}

async function handleAdminMentorPassword(req, res) {
  const body = await readBody(req);
  const mentorId = String(body.mentorId || "").trim();
  if (!store.getMentors().some((m) => m.id === mentorId)) return fail(res, 404, "导师不存在。");
  store.resetMentorPassword(mentorId);
  sendJson(res, 200, { ok: true, password: store.DEFAULT_MENTOR_PASSWORD });
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

function safeZipName(student) {
  const raw = String(student.studentId + "_" + student.name).replace(/[\\/:*?"<>|]/g, "_");
  return raw + ".pdf";
}

function collectResumeEntries(mentorId) {
  const picks = store.getPicks();
  const entries = [];
  store.getStudents().forEach((student) => {
    if (mentorId && picks[student.studentId] !== mentorId) return;
    const file = store.resumePath(student.studentId);
    if (!file || !fs.existsSync(file)) return;
    entries.push({ name: safeZipName(student), data: fs.readFileSync(file) });
  });
  return entries;
}

function handleAdminResumesZip(res, mentorId) {
  if (mentorId && !store.getMentors().some((m) => m.id === mentorId)) {
    return fail(res, 404, "导师不存在。");
  }
  const entries = collectResumeEntries(mentorId);
  if (!entries.length) return fail(res, 404, "这批学生还没有可下载的简历。");

  const body = zipStore(entries);
  const mentor = mentorId ? store.getMentors().find((m) => m.id === mentorId) : null;
  const filename = mentor
    ? "resumes-" + mentor.name + ".zip"
    : "resumes-all.zip";

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": body.length,
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function handleOwnResume(req, res, url) {
  const token = bearer(req) || url.searchParams.get("token") || "";
  const studentId = store.readStudentToken(token);
  if (!studentId) return fail(res, 401, "请先登录。");
  sendResume(res, studentId);
}

function sendResume(res, studentId) {
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
    if (tail === "/password" && method === "POST") return await handleStudentPassword(req, res), true;
    if (tail === "/pick" && method === "POST") return await handlePick(req, res), true;
    if (tail === "/resume" && method === "POST") return await handleResume(req, res), true;
    if (tail === "/resume" && method === "GET") return handleOwnResume(req, res, url), true;
    if (tail === "/avatar" && method === "POST") return await handleAvatarUpload(req, res), true;
    if (tail === "/avatar" && method === "GET") return handleAvatarGet(req, res, url), true;
    if (tail === "/image" && method === "GET") return handleMessageImage(req, res, url), true;
    if (tail === "/admin/login" && method === "POST") return await handleAdminLogin(req, res), true;

    if (tail === "/mentor/login" && method === "POST") return await handleMentorLogin(req, res), true;
    if (tail === "/mentor/group" && method === "GET") return handleMentorGroup(req, res, url), true;
    if (tail === "/mentor/password" && method === "POST") return await handleMentorPassword(req, res), true;
    if (tail === "/mentor/broadcast" && method === "POST") return await handleMentorBroadcast(req, res), true;
    if (tail === "/mentor/message/delete" && method === "POST") {
      return await handleMentorDeleteMessage(req, res), true;
    }
    if (tail === "/mentor/resume" && method === "GET") return handleMentorResume(req, res, url), true;

    const extraCtx = {
      prefix: PREFIX,
      sendJson,
      fail,
      readBody,
      currentStudent,
      bearer,
      isAdmin: store.isAdminToken,
    };
    if (await jobsApi.handle(req, res, url, extraCtx)) return true;
    if (await coordApi.handle(req, res, url, extraCtx)) return true;

    if (tail.startsWith("/admin/")) {
      const token = bearer(req) || url.searchParams.get("token") || "";
      if (!store.isAdminToken(token)) {
        fail(res, 401, "管理员登录已失效，请重新登录。");
        return true;
      }
      if (tail === "/admin/data" && method === "GET") return handleAdminData(req, res), true;
      if (tail === "/admin/config" && method === "POST") return await handleAdminConfig(req, res), true;
      if (tail === "/admin/export.csv" && method === "GET") return handleAdminExport(res), true;
      if (tail === "/admin/resumes.zip" && method === "GET") {
        return handleAdminResumesZip(res, url.searchParams.get("mentorId") || ""), true;
      }
      if (tail === "/admin/resume" && method === "GET") {
        return sendResume(res, url.searchParams.get("studentId") || ""), true;
      }
      if (tail === "/admin/message/delete" && method === "POST") {
        return await handleAdminDeleteMessage(req, res), true;
      }
      if (tail === "/admin/student" && method === "POST") return await handleAdminStudent(req, res), true;
      if (tail === "/admin/assign" && method === "POST") return await handleAdminAssign(req, res), true;
      if (tail === "/admin/delete" && method === "POST") return await handleAdminDelete(req, res), true;
      if (tail === "/admin/mentor-password" && method === "POST") {
        return await handleAdminMentorPassword(req, res), true;
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
