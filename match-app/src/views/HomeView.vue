<script setup>
import { computed } from "vue";
import SiteHero from "../components/SiteHero.vue";
import { t } from "../i18n";

const openCards = computed(() => [
  { href: "/match", icon: "match", title: t("home.matchTitle"), desc: t("home.matchDesc") },
  { href: "/courses", icon: "courses", title: t("home.coursesTitle"), desc: t("home.coursesDesc") },
  { href: "/guide", icon: "guide", title: t("home.guideTitle"), desc: t("home.guideDesc") },
  { href: "/match/mentor", icon: "mentor", title: t("home.mentorTitle"), desc: t("home.mentorDesc") },
  { href: "/jobs", icon: "jobs", title: t("home.jobsTitle"), desc: t("home.jobsDesc") },
  { href: "/coord", icon: "coord", title: t("home.coordTitle"), desc: t("home.coordDesc") },
]);

const soonCards = computed(() => [
  { icon: "alumni", title: t("home.alumniTitle"), desc: t("home.alumniDesc") },
]);
</script>

<template>
  <SiteHero
    :title="t('home.title')"
    :lede="t('home.lede')"
    :note="t('home.note')"
  />

  <main class="wrap">
    <h2 class="section">{{ t("home.open") }}</h2>
    <div class="cards">
      <a v-for="card in openCards" :key="card.href" class="card open" :href="card.href">
        <span class="icon" :data-icon="card.icon" aria-hidden="true">
          <svg v-if="card.icon === 'match'" viewBox="0 0 24 24" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.7" />
            <circle cx="16.5" cy="8.5" r="2.6" stroke="currentColor" stroke-width="1.7" />
            <path d="M3.5 18.5c.6-3 2.6-4.6 4.5-4.6s3.9 1.6 4.5 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            <path d="M13.2 18.2c.5-2.4 2.1-3.6 3.4-3.6 1.4 0 3 1.3 3.4 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <svg v-else-if="card.icon === 'guide'" viewBox="0 0 24 24" fill="none">
            <path d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.5H8A2 2 0 0 1 6 17.5V4.5Z" stroke="currentColor" stroke-width="1.7" />
            <path d="M6 17.5A2 2 0 0 1 8 15.5h10" stroke="currentColor" stroke-width="1.7" />
            <path d="M9 8h6M9 11.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <svg v-else-if="card.icon === 'mentor'" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="6" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.7" />
            <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" stroke="currentColor" stroke-width="1.7" />
            <path d="M3.5 13h17" stroke="currentColor" stroke-width="1.7" />
          </svg>
          <svg v-else-if="card.icon === 'jobs'" viewBox="0 0 24 24" fill="none">
            <path d="M8 10V7.8A1.8 1.8 0 0 1 9.8 6h4.4A1.8 1.8 0 0 1 16 7.8V10" stroke="currentColor" stroke-width="1.7" />
            <rect x="3.5" y="9.5" width="17" height="11" rx="2" stroke="currentColor" stroke-width="1.7" />
            <path d="M3.5 13.5h17" stroke="currentColor" stroke-width="1.7" />
          </svg>
          <svg v-else-if="card.icon === 'coord'" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7" />
            <path d="M3.5 10h17M8 3.5V7M16 3.5V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            <rect x="8" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
          </svg>
          <svg v-else-if="card.icon === 'courses'" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4.5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.7" />
            <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.desc }}</p>
        <span class="go">{{ t("home.go") }}</span>
      </a>
    </div>

    <h2 class="section">{{ t("home.soon") }}</h2>
    <div class="cards">
      <article v-for="card in soonCards" :key="card.title" class="card soon">
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="8" cy="8" r="2.6" stroke="currentColor" stroke-width="1.7" />
            <circle cx="16" cy="8.2" r="2.6" stroke="currentColor" stroke-width="1.7" />
            <circle cx="12" cy="16" r="2.6" stroke="currentColor" stroke-width="1.7" />
            <path d="M10.2 9.6 13.8 9.8M9.2 10.4l1.8 3.4M14.8 10.5l-1.7 3.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </span>
        <p class="soon-tag">{{ t("home.soon") }}</p>
        <h3>{{ card.title }}</h3>
        <p>{{ card.desc }}</p>
      </article>
    </div>
  </main>
</template>

<style scoped>
.section {
  margin: 8px 0 14px;
  font-size: 20px;
  color: var(--purple);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 22px 20px 18px;
  box-shadow: var(--shadow);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  background: rgba(31, 33, 82, 0.08);
  color: var(--navy);
  flex-shrink: 0;
}

.icon svg {
  width: 26px;
  height: 26px;
}

.card h3 {
  margin: 0 0 8px;
  font-size: 17px;
  line-height: 1.35;
}

.card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted);
}

.card.open:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 28px rgba(31, 33, 82, 0.12);
}

.card.open:hover .icon {
  background: var(--navy);
  color: #fff;
}

.card.open .go {
  margin-top: auto;
  padding-top: 16px;
  font-size: 13px;
  font-weight: 650;
  color: var(--purple);
}

.card.soon {
  opacity: 0.72;
  cursor: default;
}

.soon-tag {
  margin: 0 0 6px !important;
  font-size: 12px !important;
  font-weight: 650;
  color: var(--purple) !important;
}
</style>
