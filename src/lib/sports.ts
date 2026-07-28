// Shared vocabulary for the whole app — kept as plain validated strings
// rather than Prisma enums (see schema.prisma) so adding a sport or a goal
// type is a one-line change here, not a migration.

export type SportDef = { slug: string; label: string; emoji: string; usesPower: boolean; usesPace: boolean };

export const SPORTS: SportDef[] = [
  { slug: "running", label: "Бег", emoji: "🏃", usesPower: false, usesPace: true },
  { slug: "trail_running", label: "Трейл", emoji: "⛰️", usesPower: false, usesPace: true },
  { slug: "cycling", label: "Велоспорт", emoji: "🚴", usesPower: true, usesPace: false },
  { slug: "triathlon", label: "Триатлон", emoji: "🏊‍♂️", usesPower: true, usesPace: true },
  { slug: "swimming", label: "Плавание", emoji: "🏊", usesPower: false, usesPace: true },
  { slug: "rowing", label: "Гребля", emoji: "🚣", usesPower: true, usesPace: true },
  { slug: "cross_country_ski", label: "Лыжные гонки", emoji: "⛷️", usesPower: false, usesPace: true },
  { slug: "strength", label: "Силовые", emoji: "🏋️", usesPower: false, usesPace: false },
  { slug: "team_sport", label: "Игровой вид спорта", emoji: "⚽", usesPower: false, usesPace: false },
  { slug: "other", label: "Другое", emoji: "🎯", usesPower: false, usesPace: false },
];

export function sportLabel(slug: string) {
  return SPORTS.find((s) => s.slug === slug)?.label ?? slug;
}

export function sportDef(slug: string): SportDef {
  return SPORTS.find((s) => s.slug === slug) ?? SPORTS[SPORTS.length - 1];
}

export const GOAL_TYPES = [
  { key: "RACE", emoji: "🏁", title: "Подготовка к старту", text: "Есть конкретная дата и дистанция" },
  { key: "PERFORMANCE", emoji: "📈", title: "Рост результатов", text: "Без конкретного старта, но хочу быстрее/сильнее" },
  { key: "GENERAL_FITNESS", emoji: "💪", title: "Общая форма", text: "Быть в тонусе, без спортивных целей" },
  { key: "WEIGHT_LOSS", emoji: "⚖️", title: "Снижение веса", text: "Тренировки + питание для состава тела" },
  { key: "RETURN_FROM_INJURY", emoji: "🩹", title: "Возвращение после травмы/паузы", text: "Аккуратный, постепенный план" },
  { key: "HEALTH", emoji: "❤️", title: "Здоровье и долголетие", text: "Без гонки за цифрами" },
] as const;

export type GoalType = (typeof GOAL_TYPES)[number]["key"];

export const DIET_TYPES = [
  { key: "omnivore", label: "Обычное питание" },
  { key: "vegetarian", label: "Вегетарианское" },
  { key: "vegan", label: "Веганское" },
  { key: "pescatarian", label: "Пескетарианское" },
  { key: "keto", label: "Кето / низкоуглеводное" },
  { key: "halal", label: "Халяль" },
  { key: "kosher", label: "Кошерное" },
  { key: "other", label: "Другое" },
] as const;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс",
};

export function ageFromBirthDate(birthDate: Date | string | null | undefined, at: Date = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  let age = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age--;
  return age;
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/км`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || !Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export function kmFromMeters(m: number | null | undefined): number | null {
  if (m == null) return null;
  return Math.round((m / 1000) * 100) / 100;
}
