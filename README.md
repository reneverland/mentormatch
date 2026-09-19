# MentorMatch

Student–mentor matching for the CUHK-Shenzhen MSc in Information Management and Business Analytics (IMBA). Students register with a school invite code, then pick one industry mentor during an open window. Seats are first-come, first-served against each mentor’s advertised capacity.

**Student app:** `/match`  
**Admin console:** `/match/admin`

[![GitHub reneverland](https://img.shields.io/badge/GitHub-reneverland-181717?logo=github&logoColor=white)](https://github.com/reneverland/)
[![CBIT](https://img.shields.io/badge/CBIT-cuhk.edu.cn-4b1d6e)](https://cbit.cuhk.edu.cn/)

## Features

- Invite-code gate (default `ImbaGO2027`) so only programme students can register
- Registration fields: name, student ID, enrolment year, email, group-navigator opt-in; PDF résumé is optional
- One mentor per student; remaining seats shown on each card
- Students may switch mentors while the window is open; the old seat is released atomically
- Admin can set the invite code, open/close times, export CSV, and open uploaded PDFs
- Vue 3 directory UI (A–Z grouping, search, portraits) served beside a small Node static/API server on port 8500

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Vue 3 + Vue Router + Vite (`base: /match/`) |
| Backend | Node.js `http` server, JSON files under `server/match/` |
| Data | Mentor profiles from the 2026–2027 roster; capacities from the tutoring preference workbook |

No database is required. First launch writes `config.json` (hashed admin password + signing secret) and a one-time password file.

## Quick start

```bash
cd match-app
npm install
npm run build          # writes the SPA to ../match/

cd ../server
PORT=8500 node index.js
```

Then open `http://localhost:8500/match` and `http://localhost:8500/match/admin`.

Dev mode (Vite on 8501, API proxied to 8500):

```bash
# terminal 1
PORT=8500 node server/index.js

# terminal 2
cd match-app && npm run dev
```

## Default credentials

| Item | Default | Where it lives |
| --- | --- | --- |
| Student invite code | `ImbaGO2027` | `server/match/config.json` (editable in admin) |
| Admin password | generated on first start | `server/match/初始管理员密码.txt` — change it after login and delete the file |

Do not commit `config.json`, student records, picks, or uploaded PDFs.

## Refreshing the mentor roster

```bash
cd match-app
python3 tools/build-mentors.py   # or: npm run data
npm run build
```

The script reads the local Excel / single-file directory sources on the production host and writes `src/data/mentors.js` plus `server/match/mentors.json` so the UI and the capacity check stay in sync.

## API (summary)

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/match/register` | student + invite code |
| `POST` | `/api/match/login` | student ID + invite code |
| `GET` | `/api/match/state` | remaining seats + own pick |
| `POST` | `/api/match/pick` | choose / change mentor |
| `POST` | `/api/match/resume` | optional PDF |
| `GET/POST` | `/api/match/admin/*` | config, roster, CSV, résumés |

## Repository layout

```
match-app/          Vue source (do not hand-edit generated mentors.js)
server/             8500 static host + matching APIs
server/match/       mentors.json (committed); runtime JSON is gitignored
```

## Licence

MIT © 2026 [Reneverland](https://github.com/reneverland/)
