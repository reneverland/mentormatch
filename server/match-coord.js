const store = require("./match-store");
const notify = require("./notify-mail");
const { SITE } = require("./mail-templates");

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toMinutes(hm) {
  const parts = String(hm || "").split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function buildSlots(settings) {
  const interval = Number(settings.intervalMin || 10);
  const slots = [];
  (settings.windows || []).forEach((win) => {
    const start = toMinutes(win.start);
    const end = toMinutes(win.end);
    if (!DATE_RE.test(win.date) || !Number.isFinite(start) || !Number.isFinite(end) || interval < 5) return;
    for (let t = start; t + interval <= end; t += interval) {
      slots.push({
        date: win.date,
        start: fromMinutes(t),
        end: fromMinutes(t + interval),
        key: win.date + "T" + fromMinutes(t),
      });
    }
  });
  return slots;
}

function publicSettings(settings, withZoom) {
  const out = {
    enabled: settings.enabled !== false,
    title: settings.title,
    intervalMin: Number(settings.intervalMin || 10),
    windows: settings.windows || [],
  };
  if (withZoom) {
    out.zoomId = settings.zoomId || "";
    out.zoomPassword = settings.zoomPassword || "";
  }
  return out;
}

function publicBooking(item, withZoom, settings) {
  const out = {
    id: item.id,
    date: item.date,
    start: item.start,
    end: item.end,
    studentId: item.studentId,
    name: item.name,
    enrollYear: item.enrollYear,
    createdAt: item.createdAt,
  };
  if (withZoom && settings) {
    out.zoomId = settings.zoomId || "";
    out.zoomPassword = settings.zoomPassword || "";
  }
  return out;
}

function handleState(req, res, sendJson, currentStudent) {
  const settings = store.getCoordSettings();
  const student = currentStudent(req);
  const bookings = store.getCoordBookings();
  const mine = student ? bookings.find((item) => item.studentId === student.studentId) : null;
  const byKey = {};
  bookings.forEach((item) => {
    byKey[item.date + "T" + item.start] = item;
  });
  const slots = buildSlots(settings).map((slot) => {
    const booking = byKey[slot.key];
    const out = {
      date: slot.date,
      start: slot.start,
      end: slot.end,
      key: slot.key,
      taken: Boolean(booking),
      mine: Boolean(mine && mine.date === slot.date && mine.start === slot.start),
    };
    if (student && booking) {
      out.byLabel = booking.name + "-IMBA" + booking.enrollYear;
    }
    return out;
  });
  sendJson(res, 200, {
    settings: publicSettings(settings, Boolean(mine)),
    slots,
    mine: mine ? publicBooking(mine, true, settings) : null,
  });
}

async function handleBook(req, res, sendJson, fail, currentStudent, readBody) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录后再预约。");
  const settings = store.getCoordSettings();
  if (settings.enabled === false) return fail(res, 403, "预约通道未开放。");

  const body = await readBody(req);
  const date = String(body.date || "").trim();
  const start = String(body.start || "").trim();
  const valid = buildSlots(settings).find((slot) => slot.date === date && slot.start === start);
  if (!valid) return fail(res, 400, "该时间段不可预约。");

  const bookings = store.getCoordBookings();
  const occupied = bookings.find((item) => item.date === date && item.start === start);
  const mine = bookings.find((item) => item.studentId === student.studentId);
  if (occupied && (!mine || occupied.studentId !== student.studentId)) {
    return fail(res, 409, "这个时间段已被预约。");
  }

  const next = bookings.filter((item) => item.studentId !== student.studentId);
  const record = {
    id: mine ? mine.id : store.newBookingId(),
    studentId: student.studentId,
    name: student.name,
    enrollYear: student.enrollYear,
    date,
    start,
    end: valid.end,
    createdAt: new Date().toISOString(),
  };
  next.push(record);
  store.saveCoordBookings(next);
  await notify.sendTemplate(student.email, "coord-book", {
    name: student.name,
    course: settings.title,
    date,
    start,
    end: valid.end,
    zoomId: settings.zoomId,
    zoomPassword: settings.zoomPassword,
  });
  await notify.sendAdmin("admin-event", {
    subject: "预约成功：" + student.name,
    title: "实习课预约",
    paragraphs: [
      student.name + "（学号 " + student.studentId + "）已预约 " + (settings.title || "Coordinator 交流") + "。",
      "时间：" + date + " " + start + "–" + valid.end,
    ],
    buttonLabel: "查看预约",
    buttonUrl: SITE + "/coord",
  });
  sendJson(res, 200, { booking: publicBooking(record, true, settings) });
}

async function handleCancel(req, res, sendJson, fail, currentStudent) {
  const student = currentStudent(req);
  if (!student) return fail(res, 401, "请先登录。");
  const bookings = store.getCoordBookings();
  const mine = bookings.find((item) => item.studentId === student.studentId);
  store.saveCoordBookings(bookings.filter((item) => item.studentId !== student.studentId));
  if (mine) {
    const settings = store.getCoordSettings();
    await notify.sendTemplate(student.email, "coord-cancel", {
      name: student.name,
      course: settings.title,
      date: mine.date,
      start: mine.start,
      end: mine.end,
    });
    await notify.sendAdmin("admin-event", {
      subject: "预约已取消：" + student.name,
      title: "预约已取消",
      paragraphs: [
        student.name + "（学号 " + student.studentId + "）取消了 Coordinator 预约。",
        "原时段：" + mine.date + " " + mine.start + "–" + mine.end,
      ],
      buttonLabel: "查看预约",
      buttonUrl: SITE + "/coord",
    });
  }
  sendJson(res, 200, { ok: true });
}

function handleAdminGet(res, sendJson) {
  const settings = store.getCoordSettings();
  sendJson(res, 200, {
    settings: publicSettings(settings, true),
    slots: buildSlots(settings),
    bookings: store.getCoordBookings().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
  });
}

async function handleAdminSave(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const intervalMin = Number(body.intervalMin || 10);
  if (!Number.isFinite(intervalMin) || intervalMin < 5 || intervalMin > 120) {
    return fail(res, 400, "时间间隔请设为 5–120 分钟。");
  }
  const windows = Array.isArray(body.windows) ? body.windows : [];
  const cleaned = windows
    .map((win) => ({
      date: String(win.date || "").trim(),
      start: String(win.start || "").trim(),
      end: String(win.end || "").trim(),
    }))
    .filter((win) => DATE_RE.test(win.date) && TIME_RE.test(win.start) && TIME_RE.test(win.end));
  if (!cleaned.length) return fail(res, 400, "请至少保留一个可预约日期与时段。");
  cleaned.forEach((win) => {
    if (toMinutes(win.start) >= toMinutes(win.end)) throw new Error(win.date + " 的结束时间必须晚于开始时间。");
  });
  const next = {
    enabled: body.enabled !== false,
    title: String(body.title || "IBA6313 实习课程").trim(),
    intervalMin,
    zoomId: String(body.zoomId || "").trim(),
    zoomPassword: String(body.zoomPassword || "").trim(),
    windows: cleaned,
  };
  store.saveCoordSettings(next);
  sendJson(res, 200, { settings: publicSettings(next, true), slots: buildSlots(next) });
}

async function handleAdminCancel(req, res, sendJson, fail, readBody) {
  const body = await readBody(req);
  const id = String(body.id || "").trim();
  const bookings = store.getCoordBookings();
  const target = bookings.find((item) => item.id === id);
  if (!target) return fail(res, 404, "没有找到这条预约。");
  store.saveCoordBookings(bookings.filter((item) => item.id !== id));
  const student = store.getStudents().find((s) => s.studentId === target.studentId);
  if (student) {
    const settings = store.getCoordSettings();
    await notify.sendTemplate(student.email, "coord-cancel", {
      name: student.name,
      course: settings.title,
      date: target.date,
      start: target.start,
      end: target.end,
    });
    await notify.sendAdmin("admin-event", {
      subject: "管理员取消预约：" + student.name,
      title: "预约已取消",
      paragraphs: [
        "管理员取消了 " + student.name + "（学号 " + student.studentId + "）的 Coordinator 预约。",
        "原时段：" + target.date + " " + target.start + "–" + target.end,
      ],
      buttonLabel: "查看预约",
      buttonUrl: SITE + "/coord",
    });
  }
  sendJson(res, 200, { ok: true });
}

async function handle(req, res, url, ctx) {
  const tail = url.pathname.slice(ctx.prefix.length);
  const method = req.method;
  const { sendJson, fail, readBody, currentStudent, bearer, isAdmin } = ctx;

  if (tail === "/coord" && method === "GET") {
    handleState(req, res, sendJson, currentStudent);
    return true;
  }
  if (tail === "/coord/book" && method === "POST") {
    await handleBook(req, res, sendJson, fail, currentStudent, readBody);
    return true;
  }
  if (tail === "/coord/cancel" && method === "POST") {
    await handleCancel(req, res, sendJson, fail, currentStudent);
    return true;
  }

  if (tail.indexOf("/admin/coord") === 0) {
    const token = bearer(req) || url.searchParams.get("token") || "";
    if (!isAdmin(token)) {
      fail(res, 401, "管理员登录已失效，请重新登录。");
      return true;
    }
    if (tail === "/admin/coord" && method === "GET") {
      handleAdminGet(res, sendJson);
      return true;
    }
    if (tail === "/admin/coord" && method === "POST") {
      await handleAdminSave(req, res, sendJson, fail, readBody);
      return true;
    }
    if (tail === "/admin/coord/cancel" && method === "POST") {
      await handleAdminCancel(req, res, sendJson, fail, readBody);
      return true;
    }
  }
  return false;
}

module.exports = { handle };
