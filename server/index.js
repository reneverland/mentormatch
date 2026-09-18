const http = require("http");
const fs = require("fs");
const path = require("path");
const matchApi = require("./match-api");
const matchStore = require("./match-store");

const ROOT = path.resolve(__dirname, "..");
const MATCH_INDEX = path.join(ROOT, "match", "index.html");
const PORT = Number(process.env.PORT || 8500);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function send(res, code, body, headers) {
  res.writeHead(code, headers || { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

// /match 是 Vue 单页，刷新子路由时要回退到它的 index.html。
function isMatchRoute(urlPath) {
  return urlPath === "/match" || urlPath.indexOf("/match/") === 0;
}

function sendMatchIndex(res, method) {
  fs.stat(MATCH_INDEX, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, "匹配页尚未构建：请在 match-app 下执行 npm run build。");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[".html"],
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(MATCH_INDEX).pipe(res);
  });
}

const server = http.createServer(function (req, res) {
  if ((req.url || "").split("?")[0].indexOf(matchApi.PREFIX) === 0) {
    matchApi.handle(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }

  let urlPath = req.url || "/";
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = safeJoin(ROOT, urlPath);
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      if (isMatchRoute(decodeURIComponent(urlPath.split("?")[0]))) {
        sendMatchIndex(res, req.method);
        return;
      }
      send(res, 404, "Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

function logLine(msg) {
  const line = new Date().toISOString() + " " + msg;
  console.log(line);
  try {
    fs.appendFileSync(path.join(__dirname, "startup.log"), line + "\n");
  } catch (e) {}
}

server.on("error", function (err) {
  if (err && err.code === "EADDRINUSE") {
    logLine("启动失败：端口 " + PORT + " 已被占用（EADDRINUSE）。请先在宝塔停掉旧的 gtiitsch8500 或其他占用 8500 的进程，再启动 8500intendcoding。");
    process.exit(1);
  }
  logLine("启动失败：" + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  logLine("校外导师评选前端 http://" + HOST + ":" + PORT);
  logLine("静态目录 " + ROOT);
  const firstPassword = matchStore.init();
  logLine("导师匹配 学生端 /match  管理端 /match/admin");
  if (firstPassword) {
    logLine("导师匹配 管理端初始密码：" + firstPassword + "（也写入 server/match/初始管理员密码.txt）");
  }
});
