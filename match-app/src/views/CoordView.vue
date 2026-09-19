<script setup>
import { computed, onMounted, ref, watch } from "vue";
import SiteHero from "../components/SiteHero.vue";
import SiteLoginModal from "../components/SiteLoginModal.vue";
import api from "../api";
import { studentToken } from "../session";
import { t, te } from "../i18n";

const loading = ref(true);
const error = ref("");
const notice = ref("");
const showLogin = ref(false);
const settings = ref({ title: "IBA6313 实习课程", enabled: true, windows: [], intervalMin: 10 });
const slots = ref([]);
const mine = ref(null);
const mobileDay = ref("");
const weekStart = ref("");
const selectedKey = ref("");
const showMineOptions = ref(false);
const pendingSlot = ref(null);
const busy = ref(false);

function toMin(hm) {
  const parts = String(hm || "").split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function toIso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function weekdayIndex(date) {
  const d = new Date(date + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

function mondayOf(date) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - weekdayIndex(date));
  return toIso(d);
}

function shiftDate(date, days) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIso(d);
}

const openDates = computed(() => {
  const seen = {};
  const list = [];
  slots.value.forEach((slot) => {
    if (!seen[slot.date]) {
      seen[slot.date] = true;
      list.push(slot.date);
    }
  });
  list.sort();
  return list;
});

const weekStarts = computed(() => {
  const seen = {};
  openDates.value.forEach((date) => {
    seen[mondayOf(date)] = true;
  });
  return Object.keys(seen).sort();
});

const weekDates = computed(() => {
  if (!weekStart.value) return [];
  return [0, 1, 2, 3, 4, 5, 6].map((i) => shiftDate(weekStart.value, i));
});

const weekLabel = computed(() => {
  if (!weekStart.value) return "";
  const d = new Date(weekStart.value + "T00:00:00");
  return t("coord.month", { y: d.getFullYear(), m: d.getMonth() + 1 });
});

const hasPrevWeek = computed(() => weekStarts.value.some((start) => start < weekStart.value));
const hasNextWeek = computed(() => weekStarts.value.some((start) => start > weekStart.value));

const activeDate = computed(() => mobileDay.value || openDates.value[0] || weekDates.value[0] || "");

function goWeek(dir) {
  const list = weekStarts.value;
  const i = list.indexOf(weekStart.value);
  const next = list[i + dir];
  if (!next) return;
  weekStart.value = next;
  const open = openDates.value.find((date) => mondayOf(date) === next);
  mobileDay.value = open || next;
}

const range = computed(() => {
  if (!slots.value.length) return { start: 10 * 60, end: 12 * 60 };
  let start = Infinity;
  let end = -Infinity;
  slots.value.forEach((slot) => {
    start = Math.min(start, toMin(slot.start));
    end = Math.max(end, toMin(slot.end));
  });
  return { start, end };
});

const pxPerMin = computed(() => {
  const interval = Number(settings.value.intervalMin || 10);
  return Math.max(3.6, 44 / interval);
});

const bodyHeight = computed(() => Math.max(220, (range.value.end - range.value.start) * pxPerMin.value));

const timeLabels = computed(() => {
  const interval = Number(settings.value.intervalMin || 10);
  const labels = [];
  for (let m = range.value.start; m <= range.value.end; m += interval) {
    labels.push({
      top: (m - range.value.start) * pxPerMin.value,
      text: String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"),
    });
  }
  return labels;
});

function slotStyle(slot) {
  const top = (toMin(slot.start) - range.value.start) * pxPerMin.value;
  const height = Math.max(28, (toMin(slot.end) - toMin(slot.start)) * pxPerMin.value - 4);
  return { top: top + 2 + "px", height: height + "px" };
}

function dateTitle(date) {
  const names = [
    t("coord.dow1"), t("coord.dow2"), t("coord.dow3"), t("coord.dow4"),
    t("coord.dow5"), t("coord.dow6"), t("coord.dow7"),
  ];
  const d = new Date(date + "T00:00:00");
  return t("coord.dateHead", {
    dow: names[weekdayIndex(date)],
    m: d.getMonth() + 1,
    d: d.getDate(),
  });
}

function hasSlots(date) {
  return slots.value.some((slot) => slot.date === date);
}

function slotsOn(date) {
  return slots.value.filter((slot) => slot.date === date);
}

function occupant(slot) {
  if (slot.mine) return t("coord.mineTag");
  if (!slot.taken) return t("coord.free");
  return slot.byLabel || t("coord.taken");
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.coord(studentToken.value);
    settings.value = data.settings || settings.value;
    slots.value = data.slots || [];
    mine.value = data.mine || null;
    const focus = (data.mine && data.mine.date) || ((data.slots || [])[0] && data.slots[0].date) || "";
    if (focus) {
      if (!weekStart.value || weekStarts.value.indexOf(weekStart.value) === -1) {
        weekStart.value = mondayOf(focus);
      }
      if (!mobileDay.value || mondayOf(mobileDay.value) !== weekStart.value) {
        mobileDay.value = focus;
      }
    } else {
      weekStart.value = "";
      mobileDay.value = "";
    }
  } catch (err) {
    error.value = te(err.message);
  } finally {
    loading.value = false;
  }
}

function onSlot(slot) {
  selectedKey.value = slot.key;
  if (slot.mine) {
    pendingSlot.value = null;
    showMineOptions.value = true;
    return;
  }
  if (slot.taken) return;
  if (!studentToken.value) {
    showLogin.value = true;
    return;
  }
  showMineOptions.value = false;
  pendingSlot.value = slot;
}

function closeBookConfirm() {
  pendingSlot.value = null;
}

async function confirmBook() {
  if (!pendingSlot.value) return;
  await book(pendingSlot.value);
}

async function book(slot) {
  if (!studentToken.value) {
    showLogin.value = true;
    return;
  }
  if (slot.taken && !slot.mine) return;
  error.value = "";
  notice.value = "";
  busy.value = true;
  try {
    const data = await api.coordBook(studentToken.value, slot.date, slot.start);
    mine.value = data.booking;
    notice.value = t("coord.booked", { date: slot.date, start: slot.start, end: slot.end });
    showMineOptions.value = false;
    pendingSlot.value = null;
    await load();
  } catch (err) {
    error.value = te(err.message);
    if (/登录/.test(err.message)) showLogin.value = true;
  } finally {
    busy.value = false;
  }
}

async function cancelMine() {
  if (!mine.value) return;
  error.value = "";
  notice.value = "";
  busy.value = true;
  try {
    await api.coordCancel(studentToken.value);
    notice.value = t("coord.cancelled");
    showMineOptions.value = false;
    pendingSlot.value = null;
    selectedKey.value = "";
    await load();
  } catch (err) {
    error.value = te(err.message);
  } finally {
    busy.value = false;
  }
}

watch(studentToken, load);
onMounted(load);
</script>

<template>
  <SiteHero
    :title="settings.title || t('coord.fallbackTitle')"
    :lede="t('coord.lede')"
    :note="t('coord.note')"
  />

  <main class="wrap">
    <p v-if="error" class="alert error">{{ error }}</p>
    <p v-if="notice" class="alert ok">{{ notice }}</p>
    <p v-if="!settings.enabled" class="alert error">{{ t("coord.closed") }}</p>
    <p v-if="loading" class="muted">{{ t("jobs.loading") }}</p>

    <section v-if="mine" class="panel mine">
      <h2>{{ t("coord.mine") }}</h2>
      <p>{{ dateTitle(mine.date) }} {{ mine.start }}–{{ mine.end }}</p>
      <p class="zoom">{{ t("coord.zoom", { id: mine.zoomId, pwd: mine.zoomPassword }) }}</p>
      <p class="hint">{{ t("coord.manageHint") }}</p>
      <div class="mine-actions">
        <button class="btn" type="button" :disabled="busy" @click="cancelMine">{{ t("coord.cancel") }}</button>
      </div>
    </section>

    <section class="panel board">
      <div class="toolbar">
        <div class="legend">
          <span><i class="dot free"></i>{{ t("coord.free") }}</span>
          <span><i class="dot taken"></i>{{ t("coord.legendTaken") }}</span>
          <span><i class="dot mine"></i>{{ t("coord.legendMine") }}</span>
        </div>
        <p class="hint">{{ t("coord.slotHint", { n: settings.intervalMin }) }}</p>
      </div>
      <div v-if="weekDates.length" class="week-bar">
        <button
          v-if="weekStarts.length > 1"
          class="week-btn"
          type="button"
          :disabled="!hasPrevWeek"
          @click="goWeek(-1)"
        >{{ t("coord.weekPrev") }}</button>
        <strong>{{ weekLabel }}</strong>
        <button
          v-if="weekStarts.length > 1"
          class="week-btn"
          type="button"
          :disabled="!hasNextWeek"
          @click="goWeek(1)"
        >{{ t("coord.weekNext") }}</button>
      </div>

      <div v-if="weekDates.length" class="day-tabs">
        <button
          v-for="date in weekDates"
          :key="date"
          type="button"
          class="day-tab"
          :class="{ active: activeDate === date, open: hasSlots(date) }"
          @click="mobileDay = date"
        >{{ dateTitle(date) }}</button>
      </div>

      <div v-if="weekDates.length" class="calendar-scroll">
        <div
          class="calendar"
          :style="{
            gridTemplateColumns: '64px repeat(7, minmax(120px, 1fr))',
            gridTemplateRows: '52px ' + bodyHeight + 'px',
          }"
        >
          <div class="corner">{{ t("course.time") }}</div>
          <div
            v-for="(date, i) in weekDates"
            :key="'h' + date"
            class="day-head"
            :class="{ 'mobile-active': activeDate === date, open: hasSlots(date) }"
            :style="{ gridColumn: String(i + 2) }"
          >
            <span>{{ dateTitle(date) }}</span>
          </div>
          <div class="time-axis">
            <span v-for="lab in timeLabels" :key="lab.text" class="time-label" :style="{ top: lab.top + 'px' }">{{ lab.text }}</span>
          </div>
          <div
            v-for="(date, i) in weekDates"
            :key="'b' + date"
            class="day-body"
            :class="{ 'mobile-active': activeDate === date, empty: !hasSlots(date) }"
            :style="{ gridColumn: String(i + 2) }"
          >
            <button
              v-for="slot in slotsOn(date)"
              :key="slot.key"
              type="button"
              class="event"
              :class="{
                free: !slot.taken,
                taken: slot.taken && !slot.mine,
                mine: slot.mine,
                selected: selectedKey === slot.key,
              }"
              :style="slotStyle(slot)"
              @click="onSlot(slot)"
            >
              <strong>{{ slot.start }}–{{ slot.end }}</strong>
              <span>{{ occupant(slot) }}</span>
            </button>
          </div>
        </div>
      </div>
      <p v-else-if="!loading" class="muted">{{ t("coord.noSlots") }}</p>
    </section>
  </main>

  <div v-if="pendingSlot" class="modal-mask" @click.self="closeBookConfirm">
    <div class="modal">
      <h3>{{ mine ? t("coord.confirmSwitchTitle") : t("coord.confirmTitle") }}</h3>
      <p>{{ dateTitle(pendingSlot.date) }} {{ pendingSlot.start }}–{{ pendingSlot.end }}</p>
      <p v-if="mine" class="hint">{{ t("coord.confirmSwitchHint", { date: mine.date, start: mine.start, end: mine.end }) }}</p>
      <div class="modal-actions">
        <button class="btn ghost" type="button" @click="closeBookConfirm">{{ t("coord.close") }}</button>
        <button class="btn" type="button" :disabled="busy" @click="confirmBook">
          {{ mine ? t("coord.confirmSwitchGo") : t("coord.confirmGo") }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="showMineOptions && mine" class="modal-mask" @click.self="showMineOptions = false">
    <div class="modal">
      <h3>{{ t("coord.optionTitle") }}</h3>
      <p>{{ dateTitle(mine.date) }} {{ mine.start }}–{{ mine.end }}</p>
      <p class="zoom">{{ t("coord.zoom", { id: mine.zoomId, pwd: mine.zoomPassword }) }}</p>
      <p class="hint">{{ t("coord.switchHint") }}</p>
      <div class="modal-actions">
        <button class="btn ghost" type="button" @click="showMineOptions = false">{{ t("coord.close") }}</button>
        <button class="btn" type="button" :disabled="busy" @click="cancelMine">{{ t("coord.cancel") }}</button>
      </div>
    </div>
  </div>

  <SiteLoginModal v-if="showLogin" @close="showLogin = false; load()" />
</template>

<style scoped>
.mine h2 { margin: 0 0 8px; font-size: 18px; }
.mine p { margin: 0 0 8px; }
.mine-actions { margin-top: 12px; }
.zoom { font-weight: 650; color: var(--navy); }

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.legend span { display: inline-flex; align-items: center; gap: 6px; }

.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
}

.dot.free { background: #eaf7f3; border: 1px solid #bee4d9; }
.dot.taken { background: #f0f1f3; border: 1px solid #d7d9dd; }
.dot.mine { background: var(--navy); }

.day-tabs {
  display: none;
  gap: 6px;
  overflow: auto;
  padding-bottom: 10px;
}

.day-tab {
  min-width: 88px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 9px;
  padding: 8px 9px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.day-tab.active { background: var(--navy); color: #fff; border-color: var(--navy); }
.day-tab.open:not(.active) { border-color: #9bc9bc; color: #0b6952; }

.week-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 4px 0 12px;
}

.week-bar strong { font-size: 15px; color: var(--navy); }

.week-btn {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.week-btn:disabled { opacity: 0.4; cursor: default; }

.calendar-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 16px; }
.calendar {
  min-width: 980px;
  display: grid;
  position: relative;
}

.corner, .day-head {
  background: #f8fafc;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  font-weight: 650;
  color: #344054;
}

.corner { grid-column: 1; grid-row: 1; color: var(--muted); }
.day-head { grid-row: 1; line-height: 1.3; padding: 0 6px; }
.day-head.open { color: var(--navy); background: #eef6f3; }
.time-axis { grid-column: 1; grid-row: 2; position: relative; border-right: 1px solid var(--line); background: #fbfcfd; }
.time-label { position: absolute; right: 8px; transform: translateY(-50%); font-size: 10px; color: #8a94a4; }
.day-body {
  grid-row: 2;
  position: relative;
  border-right: 1px solid var(--line);
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 43px, #edf0f5 43px, #edf0f5 44px);
}

.event {
  position: absolute;
  left: 6px;
  right: 6px;
  border-radius: 8px;
  padding: 6px 8px;
  text-align: left;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
}

.event strong { display: block; font-size: 12px; }
.event span { display: block; font-size: 11px; margin-top: 2px; }
.event.free { background: #eaf7f3; border: 1px solid #bee4d9; color: #0b6952; }
.event.taken { background: #f0f1f3; border: 1px solid #d7d9dd; color: #50545d; cursor: default; }
.event.mine { background: var(--navy); border: 1px solid var(--navy); color: #fff; }
.event.selected { box-shadow: 0 0 0 2px #c4a35a; }

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(27, 19, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 40;
}

.modal {
  background: var(--card);
  border-radius: 16px;
  padding: 22px 20px 18px;
  max-width: 400px;
  width: 100%;
}

.modal h3 { margin: 0 0 10px; }
.modal p { margin: 0 0 8px; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 700px) {
  .day-tabs { display: flex; }
  .calendar {
    min-width: 0;
    grid-template-columns: 62px minmax(220px, 1fr) !important;
  }
  .day-head { display: none; }
  .day-head.mobile-active { display: flex; grid-column: 2 !important; }
  .day-body { display: none; }
  .day-body.mobile-active { display: block; grid-column: 2 !important; }
}
</style>
