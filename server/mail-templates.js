const FOOTER = "香港中文大学(深圳) 信息管理与商业分析硕士项目";
const SITE = process.env.IMBA_SITE_URL || "http://llmhi.com:8500";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout({ title, greeting, paragraphs, buttonLabel, buttonUrl, extraHtml }) {
  const lines = (paragraphs || []).map((p) => "<p style=\"margin:0 0 14px;line-height:1.7;color:#2b3140;\">" + esc(p) + "</p>").join("");
  const button = buttonLabel && buttonUrl
    ? "<p style=\"margin:22px 0 8px;\"><a href=\"" + esc(buttonUrl) + "\" style=\"display:inline-block;background:#1f2152;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:650;\">" + esc(buttonLabel) + "</a></p>"
    : "";
  const html =
    "<!DOCTYPE html><html><body style=\"margin:0;background:#f4f6fa;font-family:'PingFang SC','Microsoft YaHei',sans-serif;\">" +
    "<div style=\"max-width:560px;margin:24px auto;background:#fff;border:1px solid #d8dee8;border-radius:12px;overflow:hidden;\">" +
    "<div style=\"background:#1f2152;color:#fff;padding:18px 22px;\">" +
    "<div style=\"font-size:12px;letter-spacing:.08em;color:#d4b97a;\">IMBA 学生服务平台</div>" +
    "<div style=\"font-size:18px;font-weight:650;margin-top:6px;\">" + esc(title) + "</div>" +
    "</div>" +
    "<div style=\"padding:22px;\">" +
    (greeting ? "<p style=\"margin:0 0 14px;color:#1f2152;font-weight:650;\">" + esc(greeting) + "</p>" : "") +
    lines +
    (extraHtml || "") +
    button +
    "</div>" +
    "<div style=\"padding:14px 22px 20px;border-top:1px solid #eef1f6;font-size:12px;color:#5c6573;line-height:1.7;\">" +
    esc(FOOTER) + "<br/>此邮件由系统发送，请勿直接回复。" +
    "</div></div></body></html>";
  const text = [
    greeting || "",
    ""
  ].concat(paragraphs || []).concat([
    buttonUrl ? buttonLabel + "：" + buttonUrl : "",
    "",
    FOOTER,
  ]).filter((line, i, arr) => !(line === "" && arr[i - 1] === "")).join("\n");
  return { html, text };
}

function render(kind, vars) {
  const v = vars || {};
  const name = v.name || "同学";
  if (kind === "register") {
    return Object.assign({ subject: "欢迎加入 IMBA 学生服务平台" }, layout({
      title: "注册成功",
      greeting: name + "，你好：",
      paragraphs: [
        "你已完成 IMBA 学生服务平台注册。之后可用学号和邀请码再次进入。",
        "可在平台进行校外导师匹配、查看招聘、预约 Coordinator，并接收站内通知。",
      ],
      buttonLabel: "进入平台",
      buttonUrl: SITE + "/",
    }));
  }
  if (kind === "job-new" || kind === "job-remind") {
    const remind = kind === "job-remind";
    return Object.assign({
      subject: (remind ? "招聘提醒：" : "新招聘：") + (v.company || "") + " · " + (v.title || ""),
    }, layout({
      title: remind ? "招聘提醒" : "新的工作机会",
      greeting: name + "，你好：",
      paragraphs: [
        remind
          ? "有一条仍在招聘的岗位提醒你关注。"
          : "平台发布了新的实习 / 就业机会。",
        (v.company || "") + " · " + (v.title || ""),
        [v.city, v.experience, v.education, v.salary].filter(Boolean).join(" · "),
        v.audience || "",
        v.description || "",
      ].filter(Boolean),
      buttonLabel: "查看并投递",
      buttonUrl: SITE + "/jobs",
    }));
  }
  if (kind === "apply-inbox") {
    return Object.assign({
      subject: "【站内直投】" + (v.studentName || "") + " 投递 " + (v.company || "") + " · " + (v.title || ""),
    }, layout({
      title: "收到一份站内直投",
      greeting: "你好：",
      paragraphs: [
        (v.studentName || "") + "（IMBA" + (v.enrollYear || "") + "，学号 " + (v.studentId || "") + "）投递了 " + (v.company || "") + " · " + (v.title || "") + "。",
        "学生邮箱：" + (v.studentEmail || "未填写"),
        "投递说明：" + (v.note || "无"),
        "简历见附件，也可在管理端下载。",
      ],
      buttonLabel: "打开管理端",
      buttonUrl: SITE + "/admin",
    }));
  }
  if (kind === "apply-receipt") {
    return Object.assign({ subject: "已收到你的投递：" + (v.company || "") + " · " + (v.title || "") }, layout({
      title: "投递回执",
      greeting: name + "，你好：",
      paragraphs: [
        "已收到你对 " + (v.company || "") + " · " + (v.title || "") + " 的站内直投。",
        v.mailSent ? "简历已同步发到岗位收信邮箱 " + (v.toEmail || "") + "。" : "管理员可在后台查看你的简历。岗位邮箱：" + (v.toEmail || ""),
      ],
      buttonLabel: "查看招聘",
      buttonUrl: SITE + "/jobs",
    }));
  }
  if (kind === "mentor-broadcast") {
    return Object.assign({ subject: "导师通知：" + (v.mentorName || "校外导师") }, layout({
      title: "组内新通知",
      greeting: name + "，你好：",
      paragraphs: [
        (v.mentorName || "导师") + " 向本组发布了一条站内通知。",
        v.text || "（含图片，请到平台查看）",
        v.hasImages ? "通知含图片，请登录平台查看原图。" : "",
      ].filter(Boolean),
      buttonLabel: "打开导师匹配",
      buttonUrl: SITE + "/match",
    }));
  }
  if (kind === "inbox-dm") {
    return Object.assign({ subject: "站内信：" + (v.fromLabel || "同学") }, layout({
      title: "新的站内信",
      greeting: name + "，你好：",
      paragraphs: [
        (v.fromLabel || "同学") + " 给你发了一条站内信。",
        v.body || "",
      ],
      buttonLabel: "打开平台查看",
      buttonUrl: SITE + "/",
    }));
  }
  if (kind === "coord-book") {
    return Object.assign({ subject: "预约确认：" + (v.course || "Coordinator") }, layout({
      title: "预约成功",
      greeting: name + "，你好：",
      paragraphs: [
        "你已预约 " + (v.course || "Coordinator 交流") + "。",
        "时间：" + (v.date || "") + " " + (v.start || "") + "–" + (v.end || ""),
        v.zoomId ? "Zoom 会议号：" + v.zoomId + (v.zoomPassword ? "　密码：" + v.zoomPassword : "") : "会议信息请登录平台查看。",
      ],
      buttonLabel: "查看预约",
      buttonUrl: SITE + "/coord",
    }));
  }
  if (kind === "coord-cancel") {
    return Object.assign({ subject: "预约已取消：" + (v.course || "Coordinator") }, layout({
      title: "预约已取消",
      greeting: name + "，你好：",
      paragraphs: [
        "你的 Coordinator 预约已取消。",
        v.date ? "原时段：" + v.date + " " + (v.start || "") + "–" + (v.end || "") : "如需重新预约，请到平台选择空闲时段。",
      ],
      buttonLabel: "重新预约",
      buttonUrl: SITE + "/coord",
    }));
  }
  if (kind === "admin-event") {
    return Object.assign({ subject: v.subject || "平台事件通知" }, layout({
      title: v.title || "平台事件",
      greeting: "管理员，你好：",
      paragraphs: v.paragraphs || [v.body || "平台有新的事件。"],
      buttonLabel: v.buttonLabel || "打开平台",
      buttonUrl: v.buttonUrl || SITE + "/",
    }));
  }
  if (kind === "smtp-test") {
    return Object.assign({ subject: "IMBA 学生服务平台 · 邮件试发" }, layout({
      title: "邮件通道可用",
      greeting: "你好：",
      paragraphs: [
        "这是一封试发邮件。收到即表示 SMTP 配置可用。",
        "之后注册、招聘、投递、导师群发、站内信和预约确认都会使用同一套模板。",
      ],
      buttonLabel: "打开平台",
      buttonUrl: SITE + "/",
    }));
  }
  return Object.assign({ subject: "IMBA 学生服务平台通知" }, layout({
    title: "平台通知",
    greeting: name + "，你好：",
    paragraphs: [v.body || "你有一条新的平台通知。"],
    buttonUrl: SITE + "/",
    buttonLabel: "打开平台",
  }));
}

module.exports = { render, FOOTER, SITE };
