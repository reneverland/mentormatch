const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "match");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");
const PICKS_FILE = path.join(DATA_DIR, "picks.json");
const MENTORS_FILE = path.join(DATA_DIR, "mentors.json");

const DEFAULT_INVITE_CODE = "ImbaGO2027";
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

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

function issueStudentToken(studentId) {
  const config = getConfig();
  const id = Buffer.from(String(studentId), "utf8").toString("base64url");
  return "s." + id + "." + sign(config.secret, "student|" + studentId);
}

function readStudentToken(token) {
  if (typeof token !== "string") return "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "s") return "";
  const studentId = Buffer.from(parts[1], "base64url").toString("utf8");
  const expected = sign(getConfig().secret, "student|" + studentId);
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

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  DEFAULT_INVITE_CODE,
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
  issueStudentToken,
  readStudentToken,
  issueAdminToken,
  isAdminToken,
  checkAdminPassword,
  setAdminPassword,
  resumePath,
};
