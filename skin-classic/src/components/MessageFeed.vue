<script setup>
import api from "../api";

defineProps({
  messages: { type: Array, default: () => [] },
  token: { type: String, default: "" },
  emptyText: { type: String, default: "暂时还没有通知。" },
  deletable: { type: Boolean, default: false },
});

defineEmits(["remove"]);

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false }).replace(/:\d{2}$/, "");
}
</script>

<template>
  <ul class="feed">
    <li v-if="!messages.length" class="empty">{{ emptyText }}</li>
    <li v-for="msg in messages" :key="msg.id" class="item">
      <div class="head">
        <strong>{{ msg.mentorName }}</strong>
        <span class="time">{{ formatTime(msg.createdAt) }}</span>
        <button
          v-if="deletable"
          class="btn ghost tiny"
          type="button"
          @click="$emit('remove', msg)"
        >删除</button>
      </div>
      <p v-if="msg.text" class="text">{{ msg.text }}</p>
      <div v-if="msg.images && msg.images.length" class="shots">
        <a
          v-for="img in msg.images"
          :key="img"
          :href="api.imageUrl(token, img)"
          target="_blank"
          rel="noopener"
        >
          <img :src="api.imageUrl(token, img)" :alt="'附图 ' + img" loading="lazy" />
        </a>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.empty {
  color: var(--muted);
  font-size: 14px;
}

.item {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(255, 252, 248, 0.92);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.head strong { color: var(--purple); }

.time {
  font-size: 12px;
  color: var(--muted);
  margin-right: auto;
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.shots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.shots img {
  width: 116px;
  height: 116px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--line);
}

.tiny {
  padding: 3px 12px;
  font-size: 12px;
}
</style>
