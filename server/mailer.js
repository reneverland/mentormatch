const net = require("net");
const tls = require("tls");

function encodeSubject(subject) {
  return "=?UTF-8?B?" + Buffer.from(String(subject || ""), "utf8").toString("base64") + "?=";
}

function encodeAddress(name, email) {
  const addr = String(email || "").trim();
  const label = String(name || "").trim();
  if (!label) return addr;
  return "=?UTF-8?B?" + Buffer.from(label, "utf8").toString("base64") + "?= <" + addr + ">";
}

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      if (/^\d{3}[\s-]/.test(last) && last.charAt(3) === " ") {
        socket.removeListener("data", onData);
        socket.removeListener("error", onErr);
        resolve({ code: Number(last.slice(0, 3)), text: buf });
      }
    };
    const onErr = (err) => {
      socket.removeListener("data", onData);
      reject(err);
    };
    socket.on("data", onData);
    socket.once("error", onErr);
  });
}

function writeLine(socket, line) {
  socket.write(line + "\r\n");
}

function expectOk(reply, allowed) {
  if (allowed.indexOf(reply.code) === -1) {
    throw new Error("SMTP " + reply.code + "：" + String(reply.text).trim().slice(0, 180));
  }
}

function b64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function alternativePart(text, html) {
  if (!html) {
    return [
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64(text),
    ].join("\r\n");
  }
  const alt = "alt" + Date.now().toString(36);
  return [
    "Content-Type: multipart/alternative; boundary=\"" + alt + "\"",
    "",
    "--" + alt,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    "--" + alt,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    "--" + alt + "--",
  ].join("\r\n");
}

function buildMime({ fromHeader, to, subject, text, html, filename, fileBuffer }) {
  const lines = [
    "From: " + fromHeader,
    "To: " + to,
    "Subject: " + encodeSubject(subject),
    "MIME-Version: 1.0",
  ];
  if (!fileBuffer) {
    return lines.join("\r\n") + "\r\n" + alternativePart(text, html);
  }
  const boundary = "imba" + Date.now().toString(36);
  const safeName = String(filename || "resume.pdf").replace(/["\r\n]/g, "_");
  lines.push("Content-Type: multipart/mixed; boundary=\"" + boundary + "\"");
  lines.push("");
  lines.push("--" + boundary);
  lines.push(alternativePart(text, html));
  lines.push("--" + boundary);
  lines.push("Content-Type: application/pdf; name=\"" + safeName + "\"");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("Content-Disposition: attachment; filename=\"" + safeName + "\"");
  lines.push("");
  lines.push(fileBuffer.toString("base64"));
  lines.push("--" + boundary + "--");
  lines.push("");
  return lines.join("\r\n");
}

function connectSocket(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(20000);
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP 连接超时。"));
    });
  });
}

function upgradeTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host }, () => resolve(secure));
    secure.setTimeout(20000);
    secure.once("error", reject);
  });
}

async function sendMail(opts) {
  const host = String(opts.host || "").trim();
  const port = Number(opts.port || 587);
  const user = String(opts.user || "").trim();
  const pass = String(opts.pass || "");
  const fromEmail = String(opts.fromEmail || user).trim();
  const to = String(opts.to || "").trim();
  if (!host || !port || !fromEmail || !to) throw new Error("SMTP 配置不完整。");

  const secure = Boolean(opts.secure) || port === 465;
  let socket = await connectSocket(host, port, secure);
  let reply = await readReply(socket);
  expectOk(reply, [220]);

  writeLine(socket, "EHLO imba-jobs");
  reply = await readReply(socket);
  expectOk(reply, [250]);

  if (!secure && /STARTTLS/i.test(reply.text)) {
    writeLine(socket, "STARTTLS");
    reply = await readReply(socket);
    expectOk(reply, [220]);
    socket = await upgradeTls(socket, host);
    writeLine(socket, "EHLO imba-jobs");
    reply = await readReply(socket);
    expectOk(reply, [250]);
  }

  if (user) {
    writeLine(socket, "AUTH LOGIN");
    reply = await readReply(socket);
    expectOk(reply, [334]);
    writeLine(socket, Buffer.from(user, "utf8").toString("base64"));
    reply = await readReply(socket);
    expectOk(reply, [334]);
    writeLine(socket, Buffer.from(pass, "utf8").toString("base64"));
    reply = await readReply(socket);
    expectOk(reply, [235, 250]);
  }

  writeLine(socket, "MAIL FROM:<" + fromEmail + ">");
  reply = await readReply(socket);
  expectOk(reply, [250]);
  writeLine(socket, "RCPT TO:<" + to + ">");
  reply = await readReply(socket);
  expectOk(reply, [250, 251]);
  writeLine(socket, "DATA");
  reply = await readReply(socket);
  expectOk(reply, [354]);

  const mime = buildMime({
    fromHeader: encodeAddress(opts.fromName, fromEmail),
    to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    filename: opts.filename,
    fileBuffer: opts.fileBuffer,
  });
  socket.write(mime.replace(/^\./gm, "..") + "\r\n.\r\n");
  reply = await readReply(socket);
  expectOk(reply, [250]);
  writeLine(socket, "QUIT");
  socket.end();
}

function smtpReady(smtp) {
  return Boolean(smtp && String(smtp.host || "").trim() && String(smtp.fromEmail || smtp.user || "").trim());
}

module.exports = { sendMail, smtpReady };
