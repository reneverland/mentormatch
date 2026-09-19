const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "match");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const IMAGE_DIR = path.join(DATA_DIR, "message-images");
const AVATAR_DIR = path.join(DATA_DIR, "avatars");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");
const PICKS_FILE = path.join(DATA_DIR, "picks.json");
const MENTORS_FILE = path.join(DATA_DIR, "mentors.json");
const MENTOR_ACCOUNTS_FILE = path.join(DATA_DIR, "mentor-accounts.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const JOBS_SETTINGS_FILE = path.join(DATA_DIR, "jobs-settings.json");
const JOB_APPLIES_FILE = path.join(DATA_DIR, "job-applies.json");
const INBOX_FILE = path.join(DATA_DIR, "inbox.json");
const COORD_SETTINGS_FILE = path.join(DATA_DIR, "coord-settings.json");
const COORD_BOOKINGS_FILE = path.join(DATA_DIR, "coord-bookings.json");

const DEFAULT_CV_INBOX = "msimba@cuhk.edu.cn";
const DEFAULT_ADMIN_EMAIL = "msimba@cuhk.edu.cn";
const DEFAULT_JOBS_SETTINGS = {
  adTitle: "",
  adText: "",
  adImage: "",
  cvInboxEmail: DEFAULT_CV_INBOX,
  adminEmail: DEFAULT_ADMIN_EMAIL,
  smtp: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromName: "IMBA 学生服务",
    fromEmail: "",
  },
};

const DEFAULT_INVITE_CODE = "ImbaGO2027";
const DEFAULT_MENTOR_PASSWORD = "imba2027Go";
const DEFAULT_STUDENT_PASSWORD = "imba666";
const TEST_STUDENT_ID = "studentimba";
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MENTOR_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return fallback;
  }
}

// 先写临时文件再 rename，避免进程中断时留下半截 JSON。
function writeJson(file, value) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomString(len) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len);
}

function hashPassword(password, salt) {
  return sha256(salt + "|" + password);
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  seedMentorAccounts();
  seedStudentPasswords();
  seedTodayJobs();
  seedCoord();

  if (fs.existsSync(CONFIG_FILE)) return null;

  const password = randomString(12);
  const salt = randomString(16);
  writeJson(CONFIG_FILE, {
    inviteCode: DEFAULT_INVITE_CODE,
    openFrom: "",
    openTo: "",
    adminSalt: salt,
    adminHash: hashPassword(password, salt),
    secret: crypto.randomBytes(32).toString("hex"),
  });
  fs.writeFileSync(
    path.join(DATA_DIR, "初始管理员密码.txt"),
    "管理端 /match/admin 初始密码：" + password + "\n登录后请在页面上修改，并删除本文件。\n",
    "utf8"
  );
  return password;
}

function getConfig() {
  return readJson(CONFIG_FILE, {
    inviteCode: DEFAULT_INVITE_CODE,
    openFrom: "",
    openTo: "",
    adminSalt: "",
    adminHash: "",
    secret: "",
  });
}

function saveConfig(next) {
  writeJson(CONFIG_FILE, next);
}

function getMentors() {
  return readJson(MENTORS_FILE, []);
}

function getStudents() {
  return readJson(STUDENTS_FILE, []);
}

function saveStudents(list) {
  writeJson(STUDENTS_FILE, list);
}

function getPicks() {
  return readJson(PICKS_FILE, {});
}

function savePicks(map) {
  writeJson(PICKS_FILE, map);
}

function countsByMentor() {
  const picks = getPicks();
  const counts = {};
  Object.keys(picks).forEach((studentId) => {
    const mentorId = picks[studentId];
    if (!mentorId) return;
    counts[mentorId] = (counts[mentorId] || 0) + 1;
  });
  return counts;
}

function isOpen(config, at) {
  const now = at || new Date();
  const from = config.openFrom ? new Date(config.openFrom) : null;
  const to = config.openTo ? new Date(config.openTo) : null;
  if (!from && !to) return false;
  if (from && Number.isNaN(from.getTime())) return false;
  if (to && Number.isNaN(to.getTime())) return false;
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function applyStudentPassword(student, password, isDefault) {
  const salt = randomString(16);
  student.salt = salt;
  student.hash = hashPassword(String(password), salt);
  student.passwordDefault = Boolean(isDefault);
  student.passwordUpdatedAt = isDefault ? "" : new Date().toISOString();
}

function checkStudentPassword(student, password) {
  if (!student || !student.salt || !student.hash) return false;
  const given = hashPassword(String(password || ""), student.salt);
  if (given.length !== student.hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(student.hash));
}

function ensureStudentPassword(student) {
  if (student && student.salt && student.hash) return false;
  applyStudentPassword(student, DEFAULT_STUDENT_PASSWORD, true);
  return true;
}

function seedStudentPasswords() {
  const students = getStudents();
  let changed = false;
  students.forEach((student) => {
    if (ensureStudentPassword(student)) changed = true;
  });
  if (!students.some((student) => student.studentId === TEST_STUDENT_ID)) {
    const test = {
      studentId: TEST_STUDENT_ID,
      name: "测试学生",
      enrollYear: "2027",
      email: "studentimba@cuhk.edu.cn",
      navigator: false,
      resume: "",
      createdAt: new Date().toISOString(),
      createdBy: "seed",
    };
    applyStudentPassword(test, DEFAULT_STUDENT_PASSWORD, true);
    students.push(test);
    changed = true;
  }
  if (changed) saveStudents(students);
}

function setStudentPassword(studentId, password, isDefault) {
  const students = getStudents();
  const student = students.find((item) => item.studentId === studentId);
  if (!student) return false;
  applyStudentPassword(student, password, isDefault);
  saveStudents(students);
  return true;
}

function issueStudentToken(studentId) {
  const config = getConfig();
  const student = getStudents().find((item) => item.studentId === studentId) || {};
  const id = Buffer.from(String(studentId), "utf8").toString("base64url");
  return "s." + id + "." + sign(config.secret, "student|" + studentId + "|" + (student.hash || ""));
}

function readStudentToken(token) {
  if (typeof token !== "string") return "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "s") return "";
  const studentId = Buffer.from(parts[1], "base64url").toString("utf8");
  const student = getStudents().find((item) => item.studentId === studentId) || {};
  const expected = sign(getConfig().secret, "student|" + studentId + "|" + (student.hash || ""));
  if (
    expected.length !== parts[2].length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))
  ) {
    return "";
  }
  return studentId;
}

function issueAdminToken() {
  const config = getConfig();
  const issued = String(Date.now());
  // 把密码哈希放进签名材料，改密码后旧令牌自动失效。
  return "a." + issued + "." + sign(config.secret, "admin|" + config.adminHash + "|" + issued);
}

function isAdminToken(token) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "a") return false;
  const issued = Number(parts[1]);
  if (!Number.isFinite(issued) || Date.now() - issued > ADMIN_TOKEN_TTL_MS) return false;
  const config = getConfig();
  const expected = sign(config.secret, "admin|" + config.adminHash + "|" + parts[1]);
  if (expected.length !== parts[2].length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]));
}

function checkAdminPassword(password) {
  const config = getConfig();
  if (!config.adminHash) return false;
  const given = hashPassword(String(password || ""), config.adminSalt);
  if (given.length !== config.adminHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(config.adminHash));
}

function setAdminPassword(password) {
  const config = getConfig();
  config.adminSalt = randomString(16);
  config.adminHash = hashPassword(String(password), config.adminSalt);
  saveConfig(config);
}

function resumePath(studentId) {
  // 学号已在写入前限制为字母数字与短横线，这里再次约束，杜绝路径穿越。
  const safe = String(studentId).replace(/[^A-Za-z0-9_-]/g, "");
  if (!safe) return "";
  return path.join(UPLOAD_DIR, safe + ".pdf");
}

function avatarPath(studentId, ext) {
  const safe = String(studentId).replace(/[^A-Za-z0-9_-]/g, "");
  const cleanExt = String(ext || "").replace(/[^a-z0-9]/g, "");
  if (!safe || !cleanExt) return "";
  return path.join(AVATAR_DIR, safe + "." + cleanExt);
}

function avatarFile(student) {
  if (!student || !student.avatar) return "";
  const file = avatarPath(student.studentId, student.avatar);
  return file && fs.existsSync(file) ? file : "";
}

function clearAvatarFiles(studentId) {
  ["jpg", "jpeg", "png", "webp"].forEach((ext) => {
    const file = avatarPath(studentId, ext);
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });
}

function messageImagePath(filename) {
  const safe = String(filename).replace(/[^A-Za-z0-9_.-]/g, "");
  if (!safe || safe.indexOf("..") !== -1) return "";
  return path.join(IMAGE_DIR, safe);
}

/* ---------- 导师账号 ---------- */

function getMentorAccounts() {
  return readJson(MENTOR_ACCOUNTS_FILE, {});
}

function saveMentorAccounts(accounts) {
  writeJson(MENTOR_ACCOUNTS_FILE, accounts);
}

// 名单里的导师都预开账号，默认密码统一，登录后自己改。
function seedMentorAccounts() {
  const mentors = getMentors();
  if (!mentors.length) return;
  const accounts = getMentorAccounts();
  let changed = false;
  mentors.forEach((mentor) => {
    if (accounts[mentor.id]) return;
    const salt = randomString(16);
    accounts[mentor.id] = {
      salt,
      hash: hashPassword(DEFAULT_MENTOR_PASSWORD, salt),
      isDefault: true,
      updatedAt: "",
    };
    changed = true;
  });
  if (changed) saveMentorAccounts(accounts);
}

function checkMentorPassword(mentorId, password) {
  const account = getMentorAccounts()[mentorId];
  if (!account) return false;
  const given = hashPassword(String(password || ""), account.salt);
  if (given.length !== account.hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(account.hash));
}

function setMentorPassword(mentorId, password, isDefault) {
  const accounts = getMentorAccounts();
  const salt = randomString(16);
  accounts[mentorId] = {
    salt,
    hash: hashPassword(String(password), salt),
    isDefault: Boolean(isDefault),
    updatedAt: new Date().toISOString(),
  };
  saveMentorAccounts(accounts);
}

function resetMentorPassword(mentorId) {
  setMentorPassword(mentorId, DEFAULT_MENTOR_PASSWORD, true);
}

function issueMentorToken(mentorId) {
  const config = getConfig();
  const account = getMentorAccounts()[mentorId] || {};
  const issued = String(Date.now());
  const id = Buffer.from(String(mentorId), "utf8").toString("base64url");
  // 签名带上密码哈希，导师改密后旧令牌立即失效。
  const sig = sign(config.secret, "mentor|" + mentorId + "|" + account.hash + "|" + issued);
  return "m." + id + "." + issued + "." + sig;
}

function readMentorToken(token) {
  if (typeof token !== "string") return "";
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "m") return "";
  const issued = Number(parts[2]);
  if (!Number.isFinite(issued) || Date.now() - issued > MENTOR_TOKEN_TTL_MS) return "";
  const mentorId = Buffer.from(parts[1], "base64url").toString("utf8");
  const account = getMentorAccounts()[mentorId];
  if (!account) return "";
  const expected = sign(
    getConfig().secret,
    "mentor|" + mentorId + "|" + account.hash + "|" + parts[2]
  );
  if (expected.length !== parts[3].length) return "";
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[3]))) return "";
  return mentorId;
}

/* ---------- 组内群发 ---------- */

function getMessages() {
  return readJson(MESSAGES_FILE, []);
}

function saveMessages(list) {
  writeJson(MESSAGES_FILE, list);
}

function newMessageId() {
  return "msg-" + Date.now().toString(36) + "-" + randomString(6);
}

/* ---------- 招聘 / 站内信 ---------- */

function defaultJobsSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_JOBS_SETTINGS));
}

function getJobs() {
  return readJson(JOBS_FILE, []);
}

function saveJobs(list) {
  writeJson(JOBS_FILE, list);
}

function getJobsSettings() {
  const stored = readJson(JOBS_SETTINGS_FILE, null);
  if (!stored) return defaultJobsSettings();
  const next = defaultJobsSettings();
  next.adTitle = String(stored.adTitle || "");
  next.adText = String(stored.adText || "");
  next.adImage = String(stored.adImage || "");
  next.cvInboxEmail = String(stored.cvInboxEmail || DEFAULT_CV_INBOX);
  next.adminEmail = String(stored.adminEmail || stored.cvInboxEmail || DEFAULT_ADMIN_EMAIL);
  next.smtp = Object.assign({}, next.smtp, stored.smtp || {});
  next.smtp.port = Number(next.smtp.port || 587);
  next.smtp.secure = Boolean(next.smtp.secure);
  return next;
}

function saveJobsSettings(next) {
  writeJson(JOBS_SETTINGS_FILE, next);
}

function getJobApplies() {
  return readJson(JOB_APPLIES_FILE, []);
}

function saveJobApplies(list) {
  writeJson(JOB_APPLIES_FILE, list);
}

function getInbox() {
  return readJson(INBOX_FILE, []);
}

function saveInbox(list) {
  writeJson(INBOX_FILE, list);
}

function newJobId() {
  return "job-" + Date.now().toString(36) + "-" + randomString(6);
}

function newApplyId() {
  return "ap-" + Date.now().toString(36) + "-" + randomString(6);
}

function newInboxId() {
  return "in-" + Date.now().toString(36) + "-" + randomString(6);
}

function todayJobSeeds() {
  const now = new Date().toISOString();
  const common = {
    company: "今天国际",
    city: "深圳",
    experience: "5-10年",
    education: "硕士",
    salary: "35-50K·14薪",
    type: "fulltime",
    audience: "应届毕业生（非实习）",
    cvEmail: DEFAULT_CV_INBOX,
    status: "published",
    createdAt: now,
    publishedAt: now,
    closedAt: "",
  };
  const note =
    "需要有较强的前置工程落地经验的实习，有算法经历，可以直接站内发给我，或者简历发到renshi@cuhk.edu.cn。";
  return [
    Object.assign({}, common, {
      id: "job-today-vision",
      title: "机器视觉/感知资深算法工程师",
      description:
        "招聘【机器视觉/感知资深算法工程师】\n深圳·5-10年·硕士  35-50K·14薪\n针对应届毕业生（非实习）。\n" + note,
    }),
    Object.assign({}, common, {
      id: "job-today-llm",
      title: "行业大模型/RAG/Agent工程师",
      description:
        "招聘【行业大模型/RAG/Agent工程师】\n深圳·5-10年·硕士  35-50K·14薪\n针对应届毕业生（非实习）。\n" + note,
    }),
  ];
}

function pushInbox(list, item) {
  list.push(item);
}

function defaultCoordSettings() {
  return {
    enabled: true,
    title: "IBA6313 实习课程",
    intervalMin: 10,
    zoomId: "633486699806",
    zoomPassword: "050767",
    windows: [{ date: "2026-09-26", start: "10:00", end: "12:00" }],
  };
}

function getCoordSettings() {
  const stored = readJson(COORD_SETTINGS_FILE, null);
  if (!stored) return defaultCoordSettings();
  const next = defaultCoordSettings();
  next.enabled = stored.enabled !== false;
  next.title = String(stored.title || next.title);
  next.intervalMin = Number(stored.intervalMin || next.intervalMin);
  next.zoomId = String(stored.zoomId || next.zoomId);
  next.zoomPassword = String(stored.zoomPassword || next.zoomPassword);
  if (Array.isArray(stored.windows) && stored.windows.length) {
    next.windows = stored.windows.map((win) => ({
      date: String(win.date || "").trim(),
      start: String(win.start || "").trim(),
      end: String(win.end || "").trim(),
    })).filter((win) => win.date && win.start && win.end);
  }
  return next;
}

function saveCoordSettings(next) {
  writeJson(COORD_SETTINGS_FILE, next);
}

function getCoordBookings() {
  return readJson(COORD_BOOKINGS_FILE, []);
}

function saveCoordBookings(list) {
  writeJson(COORD_BOOKINGS_FILE, list);
}

function newBookingId() {
  return "cb-" + Date.now().toString(36) + "-" + randomString(6);
}

function seedCoord() {
  if (!fs.existsSync(COORD_SETTINGS_FILE)) saveCoordSettings(defaultCoordSettings());
  if (!fs.existsSync(COORD_BOOKINGS_FILE)) saveCoordBookings([]);
}

function seedTodayJobs() {
  if (!fs.existsSync(JOBS_SETTINGS_FILE)) {
    saveJobsSettings(defaultJobsSettings());
  }
  const jobs = getJobs();
  const seeds = todayJobSeeds();
  const added = [];
  seeds.forEach((seed) => {
    if (!jobs.some((job) => job.id === seed.id)) {
      jobs.push(seed);
      added.push(seed);
    }
  });
  if (added.length) saveJobs(jobs);

  if (!added.length) return;
  const inbox = getInbox();
  const already = {};
  inbox.forEach((msg) => {
    if (msg.type === "job" && msg.jobId) already[msg.toStudentId + "|" + msg.jobId] = true;
  });
  getStudents().forEach((student) => {
    added.forEach((job) => {
      const key = student.studentId + "|" + job.id;
      if (already[key]) return;
      pushInbox(inbox, {
        id: newInboxId(),
        type: "job",
        toStudentId: student.studentId,
        fromStudentId: "",
        fromName: "招聘发布",
        title: "新招聘：" + job.company + " · " + job.title,
        body: job.company + " 发布了 " + job.title + "（" + job.salary + "）。请到招聘页查看并投递。",
        jobId: job.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
  });
  saveInbox(inbox);
}

/* ---------- 名额档位 ---------- */

// 学生端只看档位，不看具体数字，避免互相盯名额。
function remainingBand(remaining) {
  if (remaining <= 0) return { key: "full", label: "名额已满" };
  if (remaining < 5) return { key: "tight", label: "名额紧张" };
  if (remaining < 10) return { key: "hurry", label: "出手要快哦" };
  if (remaining < 20) return { key: "roomy", label: "相对充裕" };
  return { key: "plenty", label: "比较充裕" };
}

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  IMAGE_DIR,
  AVATAR_DIR,
  DEFAULT_INVITE_CODE,
  DEFAULT_MENTOR_PASSWORD,
  DEFAULT_STUDENT_PASSWORD,
  TEST_STUDENT_ID,
  init,
  getConfig,
  saveConfig,
  getMentors,
  getStudents,
  saveStudents,
  getPicks,
  savePicks,
  countsByMentor,
  isOpen,
  applyStudentPassword,
  checkStudentPassword,
  ensureStudentPassword,
  seedStudentPasswords,
  setStudentPassword,
  issueStudentToken,
  readStudentToken,
  issueAdminToken,
  isAdminToken,
  checkAdminPassword,
  setAdminPassword,
  resumePath,
  avatarPath,
  avatarFile,
  clearAvatarFiles,
  messageImagePath,
  getMentorAccounts,
  seedMentorAccounts,
  checkMentorPassword,
  setMentorPassword,
  resetMentorPassword,
  issueMentorToken,
  readMentorToken,
  getMessages,
  saveMessages,
  newMessageId,
  remainingBand,
  DEFAULT_CV_INBOX,
  DEFAULT_ADMIN_EMAIL,
  getJobs,
  saveJobs,
  getJobsSettings,
  saveJobsSettings,
  getJobApplies,
  saveJobApplies,
  getInbox,
  saveInbox,
  newJobId,
  newApplyId,
  newInboxId,
  seedTodayJobs,
  getCoordSettings,
  saveCoordSettings,
  getCoordBookings,
  saveCoordBookings,
  newBookingId,
  seedCoord,
};
