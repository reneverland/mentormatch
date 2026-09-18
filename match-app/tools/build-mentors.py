#!/usr/bin/env python3
"""从单文件导师页与辅导 Excel 生成 src/data/mentors.js 及 public/photos/。

只读取源文件，不修改既有页面。
"""
import base64
import io
import json
from pathlib import Path

import openpyxl
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]          # /www/wwwroot/intendCoding
APP = Path(__file__).resolve().parents[1]           # match-app
SINGLE = ROOT / "2026-2027校外导师-单文件.html"
XLSX = ROOT / "2026-2027校外导师辅导.xlsx"
PHOTO_DIR = APP / "public" / "photos"
OUT = APP / "src" / "data" / "mentors.js"
SERVER_OUT = ROOT / "server" / "match" / "mentors.json"

SURNAME_LETTER = {
    "蔡": "C", "陈": "C", "崔": "C", "代": "D", "付": "F", "惠": "H",
    "蓝": "L", "刘": "L", "吕": "L", "罗": "L", "石": "S", "苏": "S",
    "孙": "S", "王": "W", "吴": "W", "夏": "X", "谢": "X", "叶": "Y",
    "张": "Z", "郑": "Z",
}

# 卡片头像显示尺寸 128px，按 2 倍图裁剪压缩，避免整页拖入十几 MB 原图。
AVATAR_PX = 256


def load_profile():
    text = SINGLE.read_text(encoding="utf-8")
    marker = "window.PROFILE_DATA = "
    start = text.index(marker) + len(marker)
    end = text.index("};\n", start) + 1
    return json.loads(text[start:end])


def load_excel():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["导师辅导偏好"]
    rows = {}
    for row in ws.iter_rows(min_row=4, values_only=True):
        name = row[2]
        if not name:
            continue
        rows[str(name).strip()] = {
            "online": (str(row[3]).strip() == "是") if row[3] else False,
            "industry": (row[6] or "").strip(),
            "expertise": (row[7] or "").strip(),
            "timePref": (row[8] or "").strip(),
            "capacity": int(row[9]) if isinstance(row[9], int) else 0,
        }
    return rows


def save_photo(idx, data_uri):
    if not data_uri or not data_uri.startswith("data:"):
        return ""
    _, b64 = data_uri.split(",", 1)
    img = Image.open(io.BytesIO(base64.b64decode(b64)))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img = ImageOps.fit(img, (AVATAR_PX, AVATAR_PX), Image.LANCZOS, centering=(0.5, 0.35))
    name = f"m{idx:02d}.jpg"
    img.save(PHOTO_DIR / name, "JPEG", quality=82, optimize=True, progressive=True)
    return name


def main():
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    for old in PHOTO_DIR.glob("m*"):
        old.unlink()

    profile = load_profile()
    prefs = load_excel()

    mentors = []
    missing = []
    for idx, person in enumerate(profile["mentors"], 1):
        name = person["name"].strip()
        pref = prefs.get(name)
        if not pref:
            missing.append(name)
            continue
        mentors.append({
            "id": f"m{idx:02d}",
            "name": name,
            "letter": SURNAME_LETTER.get(name[0], name[0]),
            "org": (person.get("org") or "").strip(),
            "dept": (person.get("dept") or "").strip(),
            "title": (person.get("title") or "").strip(),
            "photo": save_photo(idx, person.get("photo", "")),
            "online": pref["online"],
            "industry": pref["industry"],
            "expertise": pref["expertise"],
            "timePref": pref["timePref"],
            "capacity": pref["capacity"],
        })

    unmatched = sorted(set(prefs) - {m["name"] for m in mentors})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(mentors, ensure_ascii=False, indent=2)
    OUT.write_text(
        "// 由 tools/build-mentors.py 生成：姓名/单位/职位/头像来自 2026-2027校外导师-单文件.html，\n"
        "// 辅导上限与偏好来自 2026-2027校外导师辅导.xlsx。请勿手工编辑。\n"
        f"export const mentors = {body};\n\n"
        "export default mentors;\n",
        encoding="utf-8",
    )

    # 服务端按同一份名额数据做占位判断，避免前端被改后超员。
    SERVER_OUT.parent.mkdir(parents=True, exist_ok=True)
    SERVER_OUT.write_text(
        json.dumps(
            [{"id": m["id"], "name": m["name"], "capacity": m["capacity"]} for m in mentors],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"mentors: {len(mentors)}")
    print(f"capacity total: {sum(m['capacity'] for m in mentors)}")
    print(f"photos: {len(list(PHOTO_DIR.glob('m*')))}")
    if missing:
        print("单文件中有、Excel 无辅导数据:", missing)
    if unmatched:
        print("Excel 中有、单文件无卡片:", unmatched)


if __name__ == "__main__":
    main()
