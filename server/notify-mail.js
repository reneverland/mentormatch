const store = require("./match-store");
const { sendMail, smtpReady } = require("./mailer");
const templates = require("./mail-templates");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function smtpOpts() {
  const smtp = store.getJobsSettings().smtp || {};
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
    fromName: smtp.fromName || "IMBA 学生服务",
    fromEmail: smtp.fromEmail || smtp.user,
  };
}

async function sendTemplate(to, kind, vars, extra) {
  const email = String(to || "").trim();
  if (!smtpReady(store.getJobsSettings().smtp)) {
    return { ok: false, skipped: "未配置 SMTP，已跳过邮件。" };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, skipped: "邮箱无效。" };
  const rendered = templates.render(kind, vars || {});
  try {
    await sendMail(Object.assign({}, smtpOpts(), extra || {}, {
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "邮件发送失败。" };
  }
}

function adminEmail() {
  const settings = store.getJobsSettings();
  return String(settings.adminEmail || settings.cvInboxEmail || store.DEFAULT_ADMIN_EMAIL || store.DEFAULT_CV_INBOX).trim();
}

async function sendAdmin(kind, vars) {
  const email = adminEmail();
  if (!EMAIL_RE.test(email)) return { ok: false, skipped: "管理员邮箱无效。" };
  return sendTemplate(email, kind, Object.assign({ name: "管理员" }, vars || {}));
}

async function sendMany(students, kind, varsFor) {
  if (!smtpReady(store.getJobsSettings().smtp)) {
    return { emailed: 0, failed: 0, skipped: "未配置 SMTP，已跳过邮件。" };
  }
  let emailed = 0;
  let failed = 0;
  for (let i = 0; i < (students || []).length; i += 1) {
    const student = students[i];
    const result = await sendTemplate(
      student.email,
      kind,
      Object.assign({ name: student.name, enrollYear: student.enrollYear }, varsFor ? varsFor(student) : {})
    );
    if (result.ok) emailed += 1;
    else if (!result.skipped) failed += 1;
  }
  return { emailed, failed, skipped: "" };
}

module.exports = { sendTemplate, sendMany, sendAdmin, adminEmail, EMAIL_RE };
