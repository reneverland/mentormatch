<script setup>
import { computed, ref } from "vue";
import SiteHero from "../components/SiteHero.vue";
import { events, courses, paths } from "../data/courses";
import { locale, t } from "../i18n";

const START_MIN = 8 * 60 + 30;
const END_MIN = 22 * 60;
const BODY_H = 810;
const PX = BODY_H / (END_MIN - START_MIN);

const calFilter = ref("all");
const courseFilter = ref("all");
const mobileDay = ref(0);
const selected = ref(null);

function toMin(hm) {
  const parts = String(hm || "").split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function normalizedKind(kind) {
  if (kind === "core" || kind === "im-core" || kind === "ba-core") return "core";
  return kind;
}

function courseCodeFor(event) {
  return event.course_code || (event.code === "CEC" ? "" : String(event.code).split(" / ")[0]);
}

function assignLanes(dayEvents) {
  const sorted = dayEvents.slice().sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end));
  const groups = [];
  let current = [];
  let groupEnd = -1;
  sorted.forEach((e) => {
    const s = toMin(e.start);
    const en = toMin(e.end);
    if (!current.length || s < groupEnd) {
      current.push(e);
      groupEnd = Math.max(groupEnd, en);
    } else {
      groups.push(current);
      current = [e];
      groupEnd = en;
    }
  });
  if (current.length) groups.push(current);

  groups.forEach((group) => {
    const laneEnds = [];
    group.forEach((e) => {
      const s = toMin(e.start);
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = toMin(e.end);
      e._lane = lane;
    });
    const laneCount = laneEnds.length;
    group.forEach((e) => {
      e._lanes = laneCount;
    });
  });
}

const laidOut = computed(() => {
  const list = events.map((e) => Object.assign({}, e));
  for (let d = 0; d < 7; d += 1) assignLanes(list.filter((e) => e.day === d));
  return list;
});

const timeLabels = computed(() => {
  const labels = [];
  for (let m = START_MIN; m <= END_MIN; m += 30) {
    labels.push({
      top: (m - START_MIN) * PX,
      text: String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"),
    });
  }
  return labels;
});

function eventStyle(e) {
  const top = (toMin(e.start) - START_MIN) * PX;
  const height = Math.max(22, (toMin(e.end) - toMin(e.start)) * PX - 3);
  const lanes = e._lanes || 1;
  const lane = e._lane || 0;
  const widthPct = 100 / lanes;
  return {
    top: top + 2 + "px",
    height: height + "px",
    left: "calc(" + lane * widthPct + "% + 3px)",
    width: "calc(" + widthPct + "% - 6px)",
  };
}

function eventHidden(e) {
  return calFilter.value !== "all" && normalizedKind(e.kind) !== calFilter.value;
}

function courseShown(course) {
  return courseFilter.value === "all" || (course.tags || []).indexOf(courseFilter.value) !== -1;
}

const highlightCode = computed(() => (selected.value ? courseCodeFor(selected.value) : ""));

const dayNames = computed(() => [0, 1, 2, 3, 4, 5, 6].map((i) => t("course.d" + i)));

function pick(e) {
  selected.value = e;
}

function langOf(obj) {
  if (!obj) return "";
  return locale.value === "en" ? obj.en : obj.zh;
}

const calFilters = [
  { id: "all", label: "course.all" },
  { id: "core", label: "Core" },
  { id: "elective", label: "Elective" },
  { id: "cec", label: "CEC" },
  { id: "tutorial", label: "Tutorial" },
];

const courseFilters = [
  { id: "all", key: "course.filterAll" },
  { id: "core", key: "course.filterCore" },
  { id: "im-core", key: "course.filterImCore" },
  { id: "ba-core", key: "course.filterBaCore" },
  { id: "im-major", key: "course.filterImMajor" },
  { id: "ba-major", key: "course.filterBaMajor" },
  { id: "elective", key: "course.filterElective" },
];

function badgeClass(badge) {
  if (badge === "core") return "badge-core";
  if (badge === "im") return "badge-im";
  if (badge === "ba") return "badge-ba";
  return "badge-elective";
}

function badgeText(badge) {
  if (badge === "core") return "Core";
  if (badge === "im") return "IM Core";
  if (badge === "ba") return "BA Core";
  return "Elective";
}
</script>

<template>
  <SiteHero
    :title="t('course.heroTitle')"
    :lede="t('course.lede')"
    :note="t('course.note')"
    eyebrow="AY2026–27 · Fall"
  />

  <main class="wrap course-page">
    <section class="section">
      <div class="section-title">
        <div>
          <span class="kicker">{{ t("course.reqKicker") }}</span>
          <h2>{{ t("course.reqTitle") }}</h2>
          <p>{{ t("course.reqLead") }}</p>
        </div>
      </div>
      <div class="metrics">
        <div class="metric"><b>36</b><span>{{ t("course.m36") }}</span></div>
        <div class="metric"><b>18</b><span>{{ t("course.m18c") }}</span></div>
        <div class="metric"><b>18</b><span>{{ t("course.m18e") }}</span></div>
      </div>
      <div class="new-rule">{{ t("course.rule") }}</div>
      <div class="paths">
        <div class="path im">
          <h3>Information Management（IM）</h3>
          <p>{{ t("course.imLead") }}</p>
          <div class="mini-label">{{ t("course.reqCore") }}</div>
          <div class="pills">
            <span v-for="code in paths.imCore" :key="code" class="code-pill">{{ code }}</span>
          </div>
          <div class="mini-label">{{ t("course.imMajor") }}</div>
          <div class="pills">
            <span v-for="code in paths.imMajor" :key="code" class="code-pill">{{ code }}</span>
          </div>
        </div>
        <div class="path ba">
          <h3>Business Analytics（BA）</h3>
          <p>{{ t("course.baLead") }}</p>
          <div class="mini-label">{{ t("course.reqCore") }}</div>
          <div class="pills">
            <span v-for="code in paths.baCore" :key="code" class="code-pill">{{ code }}</span>
          </div>
          <div class="mini-label">{{ t("course.baMajor") }}</div>
          <div class="pills">
            <span v-for="code in paths.baMajor" :key="code" class="code-pill">{{ code }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="calendar-section">
      <div class="section-title">
        <div>
          <span class="kicker">{{ t("course.calKicker") }}</span>
          <h2>{{ t("course.calTitle") }}</h2>
          <p>{{ t("course.calLead") }}</p>
        </div>
      </div>
      <div class="calendar-shell">
        <div class="calendar-toolbar">
          <div class="legend">
            <span class="legend-item"><i class="dot core"></i>Core</span>
            <span class="legend-item"><i class="dot elective"></i>Elective</span>
            <span class="legend-item"><i class="dot tutorial"></i>Tutorial</span>
            <span class="legend-item"><i class="dot cec"></i>CEC</span>
          </div>
          <div class="cal-filters">
            <button
              v-for="item in calFilters"
              :key="item.id"
              type="button"
              class="cal-btn"
              :class="{ active: calFilter === item.id }"
              @click="calFilter = item.id"
            >{{ item.label.indexOf("course.") === 0 ? t(item.label) : item.label }}</button>
          </div>
        </div>
        <div class="day-tabs">
          <button
            v-for="(name, i) in dayNames"
            :key="name"
            type="button"
            class="day-tab"
            :class="{ active: mobileDay === i }"
            @click="mobileDay = i"
          >{{ name }}</button>
        </div>
        <div class="calendar-scroll">
          <div class="calendar" aria-label="Weekly class calendar">
            <div class="corner">{{ t("course.time") }}</div>
            <div
              v-for="(name, i) in dayNames"
              :key="'h' + i"
              class="day-head"
              :class="{ 'mobile-active': mobileDay === i }"
              :style="{ gridColumn: String(i + 2) }"
            >{{ name }}</div>
            <div class="time-axis">
              <span v-for="lab in timeLabels" :key="lab.text" class="time-label" :style="{ top: lab.top + 'px' }">{{ lab.text }}</span>
            </div>
            <div
              v-for="(name, i) in dayNames"
              :key="'b' + i"
              class="day-body"
              :class="{ 'mobile-active': mobileDay === i }"
              :style="{ gridColumn: String(i + 2) }"
            >
              <button
                v-for="e in laidOut.filter((item) => item.day === i)"
                :key="e.id"
                type="button"
                class="event"
                :class="[e.kind, { compact: (toMin(e.end) - toMin(e.start)) * PX - 3 < 70, hidden: eventHidden(e), selected: selected && selected.id === e.id }]"
                :style="eventStyle(e)"
                @click="pick(e)"
              >
                <div class="e-code">{{ e.code }}{{ e.section ? " · " + e.section : "" }}</div>
                <div class="e-title">{{ e.title }}</div>
                <div class="e-time">{{ e.start }}–{{ e.end }}</div>
              </button>
            </div>
          </div>
        </div>
        <div class="detail-panel">
          <template v-if="selected">
            <div class="detail-main">
              <div class="muted">{{ selected.label }}{{ selected.section ? " · " + selected.section : "" }}</div>
              <h3>{{ selected.code }} · {{ selected.title }}</h3>
              <p>{{ dayNames[selected.day] }} {{ selected.start }}–{{ selected.end }} · {{ selected.venue }}</p>
            </div>
            <div><span class="muted">Instructor</span><strong>{{ selected.instructor }}</strong></div>
            <div><span class="muted">Tutor</span><strong>{{ selected.tutor }}</strong></div>
          </template>
          <div v-else class="detail-empty">{{ t("course.click") }}</div>
        </div>
      </div>
      <div class="conflict-note">{{ t("course.conflict") }}</div>
      <div class="calendar-note">
        {{ t("course.noLecture") }}
        <a href="mailto:mscimba_reg@cuhk.edu.cn">mscimba_reg@cuhk.edu.cn</a>
      </div>
    </section>

    <section class="section" id="catalogue">
      <div class="section-title">
        <div>
          <span class="kicker">{{ t("course.catKicker") }}</span>
          <h2>{{ t("course.catTitle") }}</h2>
          <p>{{ t("course.catLead") }}</p>
        </div>
      </div>
      <div class="course-toolbar">
        <button
          v-for="item in courseFilters"
          :key="item.id"
          type="button"
          class="course-filter"
          :class="{ active: courseFilter === item.id }"
          @click="courseFilter = item.id"
        >{{ t(item.key) }}</button>
      </div>
      <div class="course-grid">
        <article
          v-for="course in courses"
          :key="course.code"
          class="course-card"
          :class="{ highlight: highlightCode === course.code, hidden: !courseShown(course) }"
        >
          <div class="course-head">
            <div class="course-main">
              <div class="code-line">
                <span class="course-code">{{ course.code }}</span>
                <span class="badge" :class="badgeClass(course.badge)">{{ badgeText(course.badge) }}</span>
              </div>
              <h3>{{ locale === 'en' ? course.title : course.titleZh }}</h3>
              <p class="zh">{{ locale === 'en' ? course.titleZh : course.title }}</p>
            </div>
            <span class="units">{{ t("course.units", { n: 3 }) }}</span>
          </div>
          <div class="counting">{{ langOf(course.counting) }}</div>
          <div class="people-row">
            <div><span>Instructor</span><strong>{{ course.instructor }}</strong></div>
            <div><span>Tutor</span><strong>{{ course.tutor }}</strong></div>
          </div>
          <div v-if="course.application" class="application">
            {{ t("course.apply") }}<a :href="'mailto:' + course.application">{{ course.application }}</a>
          </div>
          <details class="outline">
            <summary><span>{{ t("course.outline") }}</span><small>{{ t("course.expand") }}</small></summary>
            <div class="outline-body">
              <p>{{ langOf(course.outline) }}</p>
              <div class="topics">
                <span v-for="topic in langOf(course.topics) || []" :key="topic" class="topic">{{ topic }}</span>
              </div>
            </div>
          </details>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-title">
        <div>
          <span class="kicker">{{ t("course.adviceKicker") }}</span>
          <h2>{{ t("course.adviceTitle") }}</h2>
        </div>
      </div>
      <div class="advice">
        <div><b>{{ t("course.a1t") }}</b><span>{{ t("course.a1d") }}</span></div>
        <div><b>{{ t("course.a2t") }}</b><span>{{ t("course.a2d") }}</span></div>
        <div><b>{{ t("course.a3t") }}</b><span>{{ t("course.a3d") }}</span></div>
        <div><b>{{ t("course.a4t") }}</b><span>{{ t("course.a4d") }}</span></div>
      </div>
    </section>
    <p class="page-foot">{{ t("course.pageFoot") }}</p>
  </main>
</template>

<style scoped>
.course-page { --navy:#17346b; --blue:#315ea1; --ink:#152238; --muted:#667085; --line:#e4e9f1; color: var(--ink); }
.section { background:#fff; border:1px solid var(--line); border-radius:18px; padding:27px; margin-bottom:24px; }
.section-title { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
.section-title h2 { font-size:23px; margin:0; }
.section-title p { margin:5px 0 0; color:var(--muted); font-size:13px; }
.kicker { display:inline-block; background:#eef4ff; color:var(--blue); font-weight:750; font-size:10px; padding:4px 8px; border-radius:999px; margin-bottom:7px; letter-spacing:.04em; }
.metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.metric { border:1px solid var(--line); background:#f8faff; border-radius:13px; padding:17px; }
.metric b { font-size:27px; color:var(--navy); display:block; }
.metric span { font-size:12px; color:var(--muted); }
.new-rule { margin:18px 0; padding:15px 17px; border-radius:12px; background:#eef5ff; border:1px solid #d8e7fb; border-left:4px solid var(--blue); font-size:13px; }
.paths { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.path { border:1px solid var(--line); border-radius:15px; padding:18px; }
.path.im { border-top:4px solid var(--blue); }
.path.ba { border-top:4px solid #b65d18; }
.path h3 { margin:0 0 5px; font-size:18px; }
.path p { font-size:12px; color:var(--muted); margin:0 0 12px; }
.mini-label { font-size:11px; font-weight:750; color:#475467; margin:12px 0 7px; letter-spacing:.04em; }
.pills { display:flex; flex-wrap:wrap; gap:6px; }
.code-pill { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; border-radius:7px; padding:4px 7px; background:#eef3fb; color:#284c84; border:1px solid #dbe6f6; }
.path.ba .code-pill { background:#fff5ea; color:#965315; border-color:#f3dcc3; }

.calendar-shell { border:1px solid var(--line); border-radius:16px; overflow:hidden; background:#fff; }
.calendar-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 15px; border-bottom:1px solid var(--line); background:#fbfcfe; }
.legend,.cal-filters { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.legend-item { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted); }
.dot { width:9px; height:9px; border-radius:3px; }
.dot.core { background:#3f6fb5; } .dot.elective { background:#168568; } .dot.cec { background:#6c7280; } .dot.tutorial { background:#9b7a22; }
.cal-btn { border:1px solid var(--line); background:#fff; border-radius:999px; padding:7px 10px; font-size:11px; color:#475467; cursor:pointer; }
.cal-btn.active { background:var(--navy); color:#fff; border-color:var(--navy); }
.day-tabs { display:none; gap:6px; overflow:auto; padding:10px; border-bottom:1px solid var(--line); }
.day-tab { min-width:50px; border:1px solid var(--line); background:#fff; border-radius:9px; padding:8px 9px; font-size:11px; cursor:pointer; }
.day-tab.active { background:var(--navy); color:#fff; border-color:var(--navy); }
.calendar-scroll { overflow-x:auto; }
.calendar { min-width:1100px; display:grid; grid-template-columns:70px repeat(7,minmax(145px,1fr)); grid-template-rows:42px 810px; position:relative; }
.corner { grid-column:1; grid-row:1; background:#f8fafc; border-right:1px solid var(--line); border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--muted); font-weight:700; }
.day-head { grid-row:1; background:#f8fafc; border-right:1px solid var(--line); border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:center; text-align:center; font-size:12px; font-weight:750; color:#344054; }
.time-axis { grid-column:1; grid-row:2; position:relative; border-right:1px solid var(--line); background:#fbfcfd; }
.time-label { position:absolute; right:8px; transform:translateY(-50%); font-size:10px; color:#8a94a4; }
.day-body { grid-row:2; position:relative; border-right:1px solid var(--line); background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#edf0f5 29px,#edf0f5 30px); background-size:100% 30px; }
.event { position:absolute; border-radius:8px; padding:6px 7px; border:1px solid transparent; overflow:hidden; cursor:pointer; text-align:left; font:inherit; box-shadow:0 1px 0 rgba(0,0,0,.02); }
.event:hover { transform:translateY(-1px); box-shadow:0 5px 12px rgba(31,47,74,.12); }
.event.selected { outline:2px solid #1f2152; }
.event.core,.event.im-core { background:#eaf2ff; border-color:#bfd3f1; color:#214d86; }
.event.ba-core { background:#fff1e5; border-color:#f0cfae; color:#8b4c18; }
.event.elective { background:#eaf7f3; border-color:#bee4d9; color:#0b6952; }
.event.cec { background:#f0f1f3; border-color:#d7d9dd; color:#50545d; }
.event.tutorial { background:#fff8df; border-color:#eadca4; color:#80671c; }
.event .e-code { font-size:10px; font-weight:800; line-height:1.2; }
.event .e-title { font-size:10px; font-weight:650; line-height:1.25; margin-top:2px; }
.event .e-time { font-size:9px; opacity:.82; margin-top:3px; }
.event.compact .e-title { display:none; }
.event.hidden { display:none; }
.detail-panel { border-top:1px solid var(--line); padding:15px; display:grid; grid-template-columns:1.4fr .8fr .8fr; gap:12px; background:#fcfdff; }
.detail-panel .muted { font-size:11px; color:var(--muted); letter-spacing:.04em; }
.detail-panel strong { display:block; font-size:13px; margin-top:2px; }
.detail-main h3 { margin:2px 0 2px; font-size:16px; }
.detail-main p { margin:0; color:var(--muted); font-size:12px; }
.detail-empty { color:var(--muted); font-size:12px; grid-column:1/-1; }
.calendar-note { font-size:11px; color:var(--muted); margin-top:10px; }
.conflict-note { margin-top:12px; background:#fff8e9; border:1px solid #f0ddb4; border-radius:11px; padding:11px 13px; font-size:12px; color:#73551b; }

.course-toolbar { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:15px; }
.course-filter { border:1px solid var(--line); background:#fff; border-radius:999px; padding:7px 10px; font-size:11px; cursor:pointer; }
.course-filter.active { background:var(--navy); border-color:var(--navy); color:#fff; }
.course-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
.course-card { border:1px solid var(--line); border-radius:15px; overflow:hidden; background:#fff; }
.course-card.highlight { border-color:#89a9d7; box-shadow:0 0 0 3px #edf4ff; }
.course-card.hidden { display:none; }
.course-head { padding:16px 16px 7px; display:flex; justify-content:space-between; gap:12px; }
.code-line { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
.course-code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--blue); font-weight:800; font-size:12px; }
.badge { font-size:9px; padding:3px 6px; border-radius:999px; font-weight:750; }
.badge-core { background:#eaf2ff; color:#2457a5; } .badge-im { background:#f0ecff; color:#65509d; } .badge-ba { background:#fff1e5; color:#995217; } .badge-elective { background:#eaf8f3; color:#087a55; }
.course-head h3 { font-size:16px; line-height:1.32; margin:6px 0 1px; }
.zh { font-size:11px; color:var(--muted); margin:0; }
.units { font-size:10px; background:#f2f4f7; color:#475467; padding:4px 7px; border-radius:999px; height:max-content; white-space:nowrap; }
.counting { margin:0 16px 10px; background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:7px 9px; font-size:10px; font-weight:700; color:#475467; }
.people-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 16px 13px; }
.people-row span { display:block; font-size:9px; color:#98a2b3; }
.people-row strong { font-size:10px; color:#344054; font-weight:650; }
.application { margin:0 16px 12px; font-size:11px; background:#faf7ff; border:1px dashed #cdbcf7; padding:9px; border-radius:8px; }
.outline { border-top:1px solid var(--line); }
.outline summary { cursor:pointer; list-style:none; padding:11px 16px; background:#fbfcfe; display:flex; justify-content:space-between; font-size:11px; font-weight:750; color:var(--navy); }
.outline summary::-webkit-details-marker { display:none; }
.outline summary small { color:#98a2b3; font-weight:400; }
.outline-body { padding:13px 16px 16px; }
.outline-body p { font-size:12px; color:#475467; margin:0 0 10px; }
.topics { display:flex; gap:5px; flex-wrap:wrap; }
.topic { font-size:9px; padding:3px 6px; background:#f2f4f7; color:#475467; border-radius:999px; }
.advice { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.advice div { border:1px solid var(--line); background:#fafbfc; border-radius:12px; padding:14px; font-size:12px; }
.advice b { display:block; margin-bottom:3px; }
.advice span { color:var(--muted); }
.page-foot { font-size:12px; color:var(--muted); margin:0 0 24px; }

@media (max-width: 900px) {
  .paths, .metrics { grid-template-columns:1fr; }
  .course-grid { grid-template-columns:1fr; }
  .advice { grid-template-columns:1fr 1fr; }
}
@media (max-width: 700px) {
  .section { padding:18px; }
  .day-tabs { display:flex; }
  .calendar { min-width:0; grid-template-columns:62px minmax(240px,1fr); grid-template-rows:42px 810px; }
  .day-head { display:none; }
  .day-head.mobile-active { display:flex; grid-column:2 !important; }
  .day-body { display:none; }
  .day-body.mobile-active { display:block; grid-column:2 !important; }
  .detail-panel { grid-template-columns:1fr; }
  .people-row, .advice { grid-template-columns:1fr; }
}
</style>
