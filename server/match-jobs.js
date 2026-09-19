const fs = require("fs");
const store = require("./match-store");
const { smtpReady } = require("./mailer");
const notify = require("./notify-mail");
const { SITE } = require("./mail-templates");

const PRESENCE_TTL_MS = 90 * 1000;
const presence = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicJob(job) {
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    city: job.city,
    experience: job.experience,
    education: job.education,
    salary: job.salary,
    type: job.type,
    audience: job.audience || "",
    description: job.description,
    cvEmail: job.cvEmail || "",
    status: job.status,
    createdAt: job.createdAt || "",
    publishedAt: job.publishedAt || "",
    closedAt: job.closedAt || "",
  };
}

function publicAd(settings) {
  return {
    adTitle: settings.adTitle || "",
    adText: settings.adText || "",
    adImage: settings.adImage || "",
    cvInboxEmail: settings.cvInboxEmail || store.DEFAULT_CV_INBOX,
  };
}

function publicSmtp(smtp) {
  return {
    host: smtp.host || "",
    port: Number(smtp.port || 587),
    secure: Boolean(smtp.secure),
    user: smtp.user || "",
    pass: smtp.pass ? "••••" : "",
    fromName: smtp.fromName || "IMBA 学生服务",
    fromEmail: smtp.fromEmail || "",
    configured: smtpReady(smtp),
  };
}

function normalizeJob(body, existing) {
  const job = existing ? Object.assign({}, existing) : { id: store.newJobId(), createdAt: new Date().toISOString() };
  job.company = String(body.company || "").trim();
  job.title = String(body.title || "").trim();
  job.city = String(body.city || "").trim();
  job.experience = String(body.experience || "").trim();
  job.education = String(body.education || "").trim();
  job.salary = String(body.salary || "").trim();
  job.type = body.type === "intern" ? "intern" : "fulltime";
  job.audience = String(body.audience || "").trim();
  job.description = String(body.description || "").trim();
  job.cvEmail = String(body.cvEmail || "").trim();
  if (!job.company) throw new Error("请填写公司名称。");
  if (!job.title) throw new Error("请填写岗位名称。");
  if (job.cvEmail && !EMAIL_RE.test(job.cvEmail)) throw new Error("岗位收 CV 邮箱格式不正确。");
  if (!existing) job.status = "draft";
  job.closedAt = job.closedAt || "";
  job.publishedAt = job.publishedAt || "";
  return job;
}

function inboxFor(studentId) {
  return store
    .getInbox()
    .filter((msg) => msg.toStudentId === studentId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function avatarIndex() {
  const map = {};
  store.getStudents().forEach((student) => {
    if (student.avatar) {
      map[student.studentId] = {
        avatar: true,
        avatarAt: student.avatarUpdatedAt || "",
      };
    }
  });
  return map;
}

function publicInbox(msg, avatars) {
  const info = (avatars && msg.fromStudentId && avatars[msg.fromStudentId]) || {};
  return {
    id: msg.id,
    type: msg.type,
    fromName: msg.fromName || "",
    fromStudentId: msg.fromStudentId || "",
    fromAvatar: Boolean(info.avatar),
    fromAvatarAt: info.avatarAt || "",
    title: msg.title,
    body: msg.body,
    jobId: msg.jobId || "",
    read: Boolean(msg.read),
    createdAt: msg.createdAt,
  };
}

function publicOnline(item) {
  return {
    studentId: item.studentId,
    name: item.name,
    enrollYear: item.enrollYear,
    label: item.label,
    avatar: Boolean(item.avatar),
    avatarAt: item.avatarAt || "",
  };
}

function onlineList() {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  const list = [];
  presence.forEach((info, studentId) => {
    if (info.lastSeen < cutoff) {
      presence.delete(studentId);
      return;
    }
    list.push({
      name: info.name,
      enrollYear: info.enrollYear,
      studentId,
      label: info.name + "-IMBA" + info.enrollYear,
      avatar: Boolean(info.avatar),
      avatarAt: info.avatarAt || "",
    });
  });
  list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return list;
}

function touchPresence(student) {
  presence.set(student.studentId, {
    name: student.name,
    enrollYear: student.enrollYear,
    lastSeen: Date.now(),
    avatar: Boolean(student.avatar),
    avatarAt: student.avatarUpdatedAt || "",
  });
}

function notifyJob(job, reason) {
  const title =
    reason === "remind"
      ? "招聘提醒：" + job.company + " · " + job.title
      : "新招聘：" + job.company + " · " + job.title;
  const body =
    job.company +
    " " +
    (reason === "remind" ? "提醒关注 " : "发布了 ") +
    job.title +
    "（" +
    job.salary +
    "）。请到招聘页查看，可通过站内直投或发送简历到 " +
    (job.cvEmail || store.DEFAULT_CV_INBOX) +
    "。";
  const inbox = store.getInbox();
  const students = store.getStudents();
  students.forEach((student) => {
    inbox.push({
      id: store.newInboxId(),
      type: "job",
      toStudentId: student.studentId,
      fromStudentId: "",
      fromName: "招聘发布",
      title,
      body,
      jobId: job.id,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
  store.saveInbox(inbox);
  return students;
}

function jobMailVars(job) {
  return {
    company: job.company,
    title: job.title,
    city: job.city,
    experience: job.experience,
    education: job.education,
    salary: job.salary,
    audience: job.audience,
    description: job.description,
  };
}

function jobById(id) {
  return store.getJobs().find((job) => job.id === id) || null;
}

function handleJobsList(req, res, sendJson, currentStudent) {
  const student = currentStudent(req);
  if (student) touchPresence(student);
  const jobs = store
    .getJobs()
    .filter((job) => job.status === "published" || job.status === "closed")
    .map(publicJob)
    .sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)));
  const applies = student
    ? store.getJobApplies().filter((item) => item.studentId === student.studentId).map((item) => item.jobId)
    : [];
  sendJson(res, 200, {
    jobs,
    ad: publicAd(store.getJobsSettings()),
    appliedIds: applies,
  });
}

function handleJobDetail(res, sendJson, fail, id) {
  const job = jobById(id);
  if (!job || (job.status !== "published" && job.status !== "closed")) {
    return fail(res, 404, "没有找到该岗位。");
  }
  sendJson(res, 200, { job: publicJob(job), ad: publicAd(store.getJobsSettings()) });
}

async function handleApply(req, res, sendJson, fail, currentStudent, readBody, id) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录后再投递。");
  const job = jobById(id);
  if (!job || job.status !== "published") return fail(res, 404, "该岗位未开放投递。");

  const body = await readBody(req);
  const note = String(body.note || "").trim();
  if (note.length > 800) return fail(res, 400, "说明请控制在 800 字以内。");

  const file = store.resumePath(student.studentId);
  if (!file || !fs.existsSync(file)) return fail(res, 400, "请先在注册资料中上传 PDF 简历。");

  const applies = store.getJobApplies();
  if (applies.some((item) => item.jobId === job.id && item.studentId === student.studentId)) {
    return fail(res, 409, "你已经投递过这个岗位。");
  }

  const settings = store.getJobsSettings();
  const toEmail = job.cvEmail || settings.cvInboxEmail || store.DEFAULT_CV_INBOX;
  let mailStatus = "skipped";
  let mailError = "";
  const inboxMail = await notify.sendTemplate(toEmail, "apply-inbox", {
    studentName: student.name,
    enrollYear: student.enrollYear,
    studentId: student.studentId,
    studentEmail: student.email,
    company: job.company,
    title: job.title,
    note,
  }, {
    filename: student.resume || student.studentId + ".pdf",
    fileBuffer: fs.readFileSync(file),
  });
  if (inboxMail.ok) {
    mailStatus = "sent";
  } else if (inboxMail.error) {
    mailStatus = "failed";
    mailError = inboxMail.error;
  } else {
    mailStatus = "skipped";
    mailError = inboxMail.skipped || "";
  }

  applies.push({
    id: store.newApplyId(),
    jobId: job.id,
    studentId: student.studentId,
    name: student.name,
    enrollYear: student.enrollYear,
    email: student.email,
    note,
    createdAt: new Date().toISOString(),
    mailStatus,
    mailError,
  });
  store.saveJobApplies(applies);

  const inbox = store.getInbox();
  inbox.push({
    id: store.newInboxId(),
    type: "apply-receipt",
    toStudentId: student.studentId,
    fromStudentId: "",
    fromName: "招聘投递",
    title: "已投递 " + job.company + " · " + job.title,
    body:
      "已收到你的站内直投。岗位收信邮箱：" +
      toEmail +
      (mailStatus === "sent" ? "，简历已同步发出。" : mailStatus === "failed" ? "，邮件未发出，管理员仍可在后台下载。" : "。管理员可在后台查看简历。"),
    jobId: job.id,
    read: false,
    createdAt: new Date().toISOString(),
  });
  store.saveInbox(inbox);

  await notify.sendTemplate(student.email, "apply-receipt", {
    name: student.name,
    company: job.company,
    title: job.title,
    mailSent: mailStatus === "sent",
    toEmail,
  });

  sendJson(res, 200, {
    ok: true,
    mailStatus,
    mailError,
    message:
      mailStatus === "sent"
        ? "已投递，简历已发到 " + toEmail + "。"
        : "已投递，管理员可在后台查看简历。",
  });
}

function handleInbox(req, res, sendJson, fail, currentStudent) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录。");
  touchPresence(student);
  const items = inboxFor(student.studentId);
  const avatars = avatarIndex();
  sendJson(res, 200, {
    items: items.map((msg) => publicInbox(msg, avatars)),
    unread: items.filter((msg) => !msg.read).length,
  });
}

async function handleInboxRead(req, res, sendJson, fail, currentStudent, readBody) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录。");
  const body = await readBody(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : body.id ? [String(body.id)] : [];
  const inbox = store.getInbox();
  inbox.forEach((msg) => {
    if (msg.toStudentId === student.studentId && (ids.length === 0 || ids.indexOf(msg.id) !== -1)) {
      msg.read = true;
    }
  });
  store.saveInbox(inbox);
  const items = inboxFor(student.studentId);
  const avatars = avatarIndex();
  sendJson(res, 200, {
    items: items.map((msg) => publicInbox(msg, avatars)),
    unread: items.filter((msg) => !msg.read).length,
  });
}

async function handleDm(req, res, sendJson, fail, currentStudent, readBody) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录。");
  const body = await readBody(req);
  const toStudentId = String(body.toStudentId || "").trim();
  const text = String(body.body || body.text || "").trim();
  if (toStudentId === student.studentId) return fail(res, 400, "不能给自己发信。");
  if (!text) return fail(res, 400, "请填写消息内容。");
  if (text.length > 1000) return fail(res, 400, "站内信请控制在 1000 字以内。");
  const target = store.getStudents().find((s) => s.studentId === toStudentId);
  if (!target) return fail(res, 404, "对方不在注册名单中。");

  const inbox = store.getInbox();
  inbox.push({
    id: store.newInboxId(),
    type: "dm",
    toStudentId,
    fromStudentId: student.studentId,
    fromName: student.name + "-IMBA" + student.enrollYear,
    title: "来自 " + student.name + "-IMBA" + student.enrollYear,
    body: text,
    jobId: "",
    read: false,
    createdAt: new Date().toISOString(),
  });
  store.saveInbox(inbox);
  await notify.sendTemplate(target.email, "inbox-dm", {
    name: target.name,
    fromLabel: student.name + "-IMBA" + student.enrollYear,
    body: text,
  });
  sendJson(res, 200, { ok: true });
}

function handlePresenceGet(req, res, sendJson, fail, currentStudent) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录后查看在线同学。");
  touchPresence(student);
  const online = onlineList();
  sendJson(res, 200, {
    count: online.length,
    students: online.map(publicOnline),
  });
}

function handleHeartbeat(req, res, sendJson, fail, currentStudent) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录。");
  touchPresence(student);
  const items = inboxFor(student.studentId);
  const online = onlineList();
  sendJson(res, 200, {
    count: online.length,
    students: online.map(publicOnline),
    unread: items.filter((msg) => !msg.read).length,
  });
}

function handleAdminJobs(res, sendJson) {
  const settings = store.getJobsSettings();
  sendJson(res, 200, {
    jobs: store.getJobs().map(publicJob).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    settings: {
      adTitle: settings.adTitle,
      adText: settings.adText,
      adImage: settings.adImage,
      cvInboxEmail: settings.cvInboxEmail,
      adminEmail: settings.adminEmail || settings.cvInboxEmail,
      smtp: publicSmtp(settings.smtp),
    },
    applies: store
      .getJobApplies()
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  });
}

async function handleAdminSaveJob(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const jobs = store.getJobs();
  const id = String(body.id || "").trim();
  const existing = id ? jobs.find((job) => job.id === id) : null;
  if (id && !existing) return fail(res, 404, "没有找到该岗位。");
  const job = normalizeJob(body, existing);
  if (existing) {
    const index = jobs.findIndex((item) => item.id === existing.id);
    jobs[index] = job;
  } else {
    jobs.push(job);
  }
  store.saveJobs(jobs);
  sendJson(res, 200, { job: publicJob(job) });
}

async function publishJob(req, res, sendJson, fail, readBody, remind) {
  const body = await readBody(req);
  const jobs = store.getJobs();
  const job = jobs.find((item) => item.id === String(body.id || "").trim());
  if (!job) return fail(res, 404, "没有找到该岗位。");
  if (!remind) {
    job.status = "published";
    job.publishedAt = new Date().toISOString();
    job.closedAt = "";
    store.saveJobs(jobs);
  } else if (job.status !== "published") {
    return fail(res, 400, "只能提醒已发布的岗位。");
  }
  const students = notifyJob(job, remind ? "remind" : "publish");
  const mail = await notify.sendMany(students, remind ? "job-remind" : "job-new", () => jobMailVars(job));
  await notify.sendAdmin("admin-event", {
    subject: (remind ? "招聘提醒已发送：" : "招聘已发布：") + job.company + " · " + job.title,
    title: remind ? "招聘提醒" : "招聘发布",
    paragraphs: [
      remind ? "已向学生发送招聘提醒。" : "平台发布了新的实习 / 就业机会。",
      job.company + " · " + job.title,
      [job.city, job.experience, job.education, job.salary].filter(Boolean).join(" · "),
    ].filter(Boolean),
    buttonLabel: "查看招聘",
    buttonUrl: SITE + "/jobs",
  });
  sendJson(res, 200, {
    job: publicJob(job),
    notified: students.length,
    emailed: mail.emailed || 0,
    failed: mail.failed || 0,
    skipped: mail.skipped || "",
  });
}

async function handleAdminCloseJob(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const jobs = store.getJobs();
  const job = jobs.find((item) => item.id === String(body.id || "").trim());
  if (!job) return fail(res, 404, "没有找到该岗位。");
  job.status = "closed";
  job.closedAt = new Date().toISOString();
  store.saveJobs(jobs);
  sendJson(res, 200, { job: publicJob(job) });
}

async function handleAdminDeleteJob(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const id = String(body.id || "").trim();
  const jobs = store.getJobs();
  if (!jobs.some((job) => job.id === id)) return fail(res, 404, "没有找到该岗位。");
  store.saveJobs(jobs.filter((job) => job.id !== id));
  sendJson(res, 200, { ok: true });
}

async function handleAdminSettings(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const current = store.getJobsSettings();
  const cvInboxEmail = String(body.cvInboxEmail || "").trim();
  if (!EMAIL_RE.test(cvInboxEmail)) return fail(res, 400, "收 CV 邮箱格式不正确。");
  current.adTitle = String(body.adTitle || "").trim();
  current.adText = String(body.adText || "").trim();
  current.adImage = String(body.adImage || "").trim();
  current.cvInboxEmail = cvInboxEmail;
  const adminEmail = String(body.adminEmail || cvInboxEmail).trim();
  current.adminEmail = EMAIL_RE.test(adminEmail) ? adminEmail : cvInboxEmail;
  const smtp = body.smtp || {};
  current.smtp.host = String(smtp.host || "").trim();
  current.smtp.port = Number(smtp.port || 587);
  current.smtp.secure = Boolean(smtp.secure);
  current.smtp.user = String(smtp.user || "").trim();
  current.smtp.fromName = String(smtp.fromName || "IMBA 学生服务").trim();
  current.smtp.fromEmail = String(smtp.fromEmail || "").trim();
  const nextPass = String(smtp.pass || "");
  if (nextPass && nextPass !== "••••") current.smtp.pass = nextPass;
  store.saveJobsSettings(current);
  sendJson(res, 200, { ok: true, smtp: publicSmtp(current.smtp) });
}

async function handleAdminTestMail(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const settings = store.getJobsSettings();
  if (!smtpReady(settings.smtp)) return fail(res, 400, "请先保存完整的 SMTP 配置。");
  const to = String(body.to || settings.smtp.fromEmail || settings.smtp.user).trim();
  if (!EMAIL_RE.test(to)) return fail(res, 400, "试发邮箱格式不正确。");
  const result = await notify.sendTemplate(to, "smtp-test", {});
  if (!result.ok) return fail(res, 400, result.error || result.skipped || "试发失败。");
  sendJson(res, 200, { ok: true });
}

function handleApplyResume(res, fail, applyId) {
  const apply = store.getJobApplies().find((item) => item.id === applyId);
  if (!apply) return fail(res, 404, "没有找到这条投递。");
  const student = store.getStudents().find((s) => s.studentId === apply.studentId);
  const file = student ? store.resumePath(student.studentId) : "";
  if (!file || !fs.existsSync(file)) return fail(res, 404, "没有找到该学生的简历。");
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Length": stat.size,
    "Content-Disposition":
      "inline; filename*=UTF-8''" + encodeURIComponent(student.resume || student.studentId + ".pdf"),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

async function handle(req, res, url, ctx) {
  const tail = url.pathname.slice(ctx.prefix.length);
  const method = req.method;
  const { sendJson, fail, readBody, currentStudent, bearer, isAdmin } = ctx;

  if (tail === "/jobs" && method === "GET") {
    handleJobsList(req, res, sendJson, currentStudent);
    return true;
  }
  if (tail.indexOf("/jobs/") === 0 && tail.indexOf("/apply") === -1 && method === "GET") {
    handleJobDetail(res, sendJson, fail, decodeURIComponent(tail.slice("/jobs/".length)));
    return true;
  }
  if (tail.indexOf("/jobs/") === 0 && tail.slice(-6) === "/apply" && method === "POST") {
    const id = decodeURIComponent(tail.slice("/jobs/".length, -6));
    await handleApply(req, res, sendJson, fail, currentStudent, readBody, id);
    return true;
  }
  if (tail === "/inbox" && method === "GET") {
    handleInbox(req, res, sendJson, fail, currentStudent);
    return true;
  }
  if (tail === "/inbox/read" && method === "POST") {
    await handleInboxRead(req, res, sendJson, fail, currentStudent, readBody);
    return true;
  }
  if (tail === "/inbox/dm" && method === "POST") {
    await handleDm(req, res, sendJson, fail, currentStudent, readBody);
    return true;
  }
  if (tail === "/presence" && method === "GET") {
    handlePresenceGet(req, res, sendJson, fail, currentStudent);
    return true;
  }
  if (tail === "/presence/heartbeat" && method === "POST") {
    handleHeartbeat(req, res, sendJson, fail, currentStudent);
    return true;
  }

  if (tail.indexOf("/admin/jobs") === 0 || tail === "/admin/jobs-settings" || tail === "/admin/jobs-settings/test") {
    const token = bearer(req) || url.searchParams.get("token") || "";
    if (!isAdmin(token)) {
      fail(res, 401, "管理员登录已失效，请重新登录。");
      return true;
    }
    if (tail === "/admin/jobs" && method === "GET") {
      handleAdminJobs(res, sendJson);
      return true;
    }
    if (tail === "/admin/jobs" && method === "POST") {
      await handleAdminSaveJob(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/jobs/publish" && method === "POST") {
      await publishJob(req, res, sendJson, fail, readBody, false);
      return true;
    }
    if (tail === "/admin/jobs/remind" && method === "POST") {
      await publishJob(req, res, sendJson, fail, readBody, true);
      return true;
    }
    if (tail === "/admin/jobs/close" && method === "POST") {
      await handleAdminCloseJob(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/jobs/delete" && method === "POST") {
      await handleAdminDeleteJob(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/jobs-settings" && method === "POST") {
      await handleAdminSettings(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/jobs-settings/test" && method === "POST") {
      await handleAdminTestMail(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/jobs/apply-resume" && method === "GET") {
      handleApplyResume(res, fail, url.searchParams.get("applyId") || "");
      return true;
    }
  }

  return false;
}

module.exports = { handle };
