const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "match", "imba.sqlite");

let Database = null;
let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  enroll_year TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  navigator INTEGER NOT NULL DEFAULT 0,
  resume TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  salt TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL DEFAULT '',
  password_default INTEGER NOT NULL DEFAULT 1,
  password_updated_at TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  avatar_updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS picks (
  student_id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mentors (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mentor_accounts (
  mentor_id TEXT PRIMARY KEY,
  salt TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_applies (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  to_student_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_to ON inbox(to_student_id);
CREATE TABLE IF NOT EXISTS coord_bookings (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  student_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  stored_path TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (student_id, kind)
);
`;

function open() {
  if (db) return db;
  Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

function hasKv(key) {
  return Boolean(open().prepare("SELECT 1 FROM kv WHERE k = ?").get(key));
}

function getKv(key, fallback) {
  const row = open().prepare("SELECT v FROM kv WHERE k = ?").get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.v);
  } catch (err) {
    return fallback;
  }
}

function setKv(key, value) {
  open()
    .prepare("INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .run(key, JSON.stringify(value));
}

function rowStudent(row) {
  return {
    studentId: row.student_id,
    name: row.name,
    enrollYear: row.enroll_year,
    email: row.email,
    navigator: Boolean(row.navigator),
    resume: row.resume || "",
    createdAt: row.created_at || "",
    createdBy: row.created_by || "",
    salt: row.salt || "",
    hash: row.hash || "",
    passwordDefault: Boolean(row.password_default),
    passwordUpdatedAt: row.password_updated_at || "",
    avatar: row.avatar || "",
    avatarUpdatedAt: row.avatar_updated_at || "",
  };
}

function getStudents() {
  return open().prepare("SELECT * FROM students ORDER BY created_at, student_id").all().map(rowStudent);
}

function saveStudents(list) {
  const insert = open().prepare(
    "INSERT INTO students(student_id, name, enroll_year, email, navigator, resume, created_at, created_by, salt, hash, password_default, password_updated_at, avatar, avatar_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  const tx = open().transaction((rows) => {
    open().prepare("DELETE FROM students").run();
    (rows || []).forEach((s) => {
      insert.run(
        s.studentId,
        s.name || "",
        s.enrollYear || "",
        s.email || "",
        s.navigator ? 1 : 0,
        s.resume || "",
        s.createdAt || "",
        s.createdBy || "",
        s.salt || "",
        s.hash || "",
        s.passwordDefault ? 1 : 0,
        s.passwordUpdatedAt || "",
        s.avatar || "",
        s.avatarUpdatedAt || ""
      );
    });
  });
  tx(list || []);
}

function getPicks() {
  const map = {};
  open().prepare("SELECT student_id, mentor_id FROM picks").all().forEach((row) => {
    map[row.student_id] = row.mentor_id;
  });
  return map;
}

function savePicks(map) {
  const insert = open().prepare("INSERT INTO picks(student_id, mentor_id) VALUES(?, ?)");
  const tx = open().transaction((obj) => {
    open().prepare("DELETE FROM picks").run();
    Object.keys(obj || {}).forEach((studentId) => {
      if (obj[studentId]) insert.run(studentId, obj[studentId]);
    });
  });
  tx(map || {});
}

function getJsonRows(table) {
  return open().prepare("SELECT payload FROM " + table).all().map((row) => JSON.parse(row.payload));
}

function saveJsonRows(table, list, idOf) {
  const insert = open().prepare("INSERT INTO " + table + "(id, payload) VALUES(?, ?)");
  const tx = open().transaction((rows) => {
    open().prepare("DELETE FROM " + table).run();
    (rows || []).forEach((item) => {
      insert.run(idOf(item), JSON.stringify(item));
    });
  });
  tx(list || []);
}

function getMentors() {
  return getJsonRows("mentors");
}

function saveMentors(list) {
  saveJsonRows("mentors", list, (item) => item.id);
}

function getMentorAccounts() {
  const map = {};
  open().prepare("SELECT * FROM mentor_accounts").all().forEach((row) => {
    map[row.mentor_id] = {
      salt: row.salt,
      hash: row.hash,
      isDefault: Boolean(row.is_default),
      updatedAt: row.updated_at || "",
    };
  });
  return map;
}

function saveMentorAccounts(accounts) {
  const insert = open().prepare(
    "INSERT INTO mentor_accounts(mentor_id, salt, hash, is_default, updated_at) VALUES(?,?,?,?,?)"
  );
  const tx = open().transaction((obj) => {
    open().prepare("DELETE FROM mentor_accounts").run();
    Object.keys(obj || {}).forEach((id) => {
      const a = obj[id] || {};
      insert.run(id, a.salt || "", a.hash || "", a.isDefault ? 1 : 0, a.updatedAt || "");
    });
  });
  tx(accounts || {});
}

function getMessages() {
  return getJsonRows("messages");
}

function saveMessages(list) {
  saveJsonRows("messages", list, (item) => item.id);
}

function getJobs() {
  return getJsonRows("jobs");
}

function saveJobs(list) {
  saveJsonRows("jobs", list, (item) => item.id);
}

function getJobApplies() {
  return getJsonRows("job_applies");
}

function saveJobApplies(list) {
  saveJsonRows("job_applies", list, (item) => item.id);
}

function getInbox() {
  return open()
    .prepare("SELECT payload FROM inbox ORDER BY created_at DESC, id DESC")
    .all()
    .map((row) => JSON.parse(row.payload));
}

function saveInbox(list) {
  const insert = open().prepare(
    "INSERT INTO inbox(id, to_student_id, created_at, payload) VALUES(?,?,?,?)"
  );
  const tx = open().transaction((rows) => {
    open().prepare("DELETE FROM inbox").run();
    (rows || []).forEach((item) => {
      insert.run(item.id, item.toStudentId || "", item.createdAt || "", JSON.stringify(item));
    });
  });
  tx(list || []);
}

function getCoordBookings() {
  return getJsonRows("coord_bookings");
}

function saveCoordBookings(list) {
  const insert = open().prepare("INSERT INTO coord_bookings(id, student_id, payload) VALUES(?,?,?)");
  const tx = open().transaction((rows) => {
    open().prepare("DELETE FROM coord_bookings").run();
    (rows || []).forEach((item) => {
      insert.run(item.id, item.studentId || "", JSON.stringify(item));
    });
  });
  tx(list || []);
}

function upsertFile(record) {
  open()
    .prepare(
      "INSERT INTO files(student_id, kind, filename, stored_path, bytes, updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id, kind) DO UPDATE SET filename=excluded.filename, stored_path=excluded.stored_path, bytes=excluded.bytes, updated_at=excluded.updated_at"
    )
    .run(
      record.studentId,
      record.kind,
      record.filename || "",
      record.storedPath || "",
      Number(record.bytes || 0),
      record.updatedAt || new Date().toISOString()
    );
}

function studentCount() {
  return open().prepare("SELECT COUNT(*) AS n FROM students").get().n;
}

function imported() {
  return hasKv("imported_at");
}

function markImported() {
  setKv("imported_at", new Date().toISOString());
}

function migrateFromJson(files) {
  if (imported() && studentCount() > 0) return { skipped: true };
  const read = files.readJson;
  const mentors = read(files.mentors, []);
  if (mentors.length && !getMentors().length) saveMentors(mentors);
  const config = read(files.config, null);
  if (config && !hasKv("config")) setKv("config", config);
  const students = read(files.students, []);
  if (students.length && !studentCount()) saveStudents(students);
  const picks = read(files.picks, {});
  if (Object.keys(picks).length && !open().prepare("SELECT COUNT(*) AS n FROM picks").get().n) {
    savePicks(picks);
  }
  const accounts = read(files.mentorAccounts, {});
  if (Object.keys(accounts).length && !open().prepare("SELECT COUNT(*) AS n FROM mentor_accounts").get().n) {
    saveMentorAccounts(accounts);
  }
  const messages = read(files.messages, []);
  if (messages.length && !getMessages().length) saveMessages(messages);
  const jobs = read(files.jobs, []);
  if (jobs.length && !getJobs().length) saveJobs(jobs);
  const settings = read(files.jobsSettings, null);
  if (settings && !hasKv("jobs_settings")) setKv("jobs_settings", settings);
  const applies = read(files.jobApplies, []);
  if (applies.length && !getJobApplies().length) saveJobApplies(applies);
  const inbox = read(files.inbox, []);
  if (inbox.length && !getInbox().length) saveInbox(inbox);
  const coordSettings = read(files.coordSettings, null);
  if (coordSettings && !hasKv("coord_settings")) setKv("coord_settings", coordSettings);
  const bookings = read(files.coordBookings, []);
  if (bookings.length && !getCoordBookings().length) saveCoordBookings(bookings);
  markImported();
  return { skipped: false, students: studentCount() };
}

function syncStudentFiles(student, paths) {
  if (!student || !student.studentId) return;
  if (student.resume && paths.resumePath) {
    const file = paths.resumePath(student.studentId);
    if (file && fs.existsSync(file)) {
      upsertFile({
        studentId: student.studentId,
        kind: "resume",
        filename: student.resume,
        storedPath: file,
        bytes: fs.statSync(file).size,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  if (student.avatar && paths.avatarFile) {
    const file = paths.avatarFile(student);
    if (file) {
      upsertFile({
        studentId: student.studentId,
        kind: "avatar",
        filename: path.basename(file),
        storedPath: file,
        bytes: fs.statSync(file).size,
        updatedAt: student.avatarUpdatedAt || new Date().toISOString(),
      });
    }
  }
}

module.exports = {
  DB_FILE,
  open,
  hasKv,
  getKv,
  setKv,
  getStudents,
  saveStudents,
  getPicks,
  savePicks,
  getMentors,
  saveMentors,
  getMentorAccounts,
  saveMentorAccounts,
  getMessages,
  saveMessages,
  getJobs,
  saveJobs,
  getJobApplies,
  saveJobApplies,
  getInbox,
  saveInbox,
  getCoordBookings,
  saveCoordBookings,
  upsertFile,
  studentCount,
  migrateFromJson,
  syncStudentFiles,
};
