import { prisma } from "@/lib/prisma";

export type FunnelStage = { key: string; label: string; count: number; percentOfTotal: number; droppedFromPrev: number };
export type SignupPoint = { date: string; label: string; count: number };

export type AdminOverview = {
  totalUsers: number;
  onboardedUsers: number;
  active7d: number;
  active30d: number;
  unreadMessages: number;
  unreadThreads: number;
  funnel: FunnelStage[];
  signupTrend: SignupPoint[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d14 = new Date(now.getTime() - 14 * 86400000);

  const [
    totalUsers, onboardedUsers, connectedDevices, loggedActivity,
    active7dUsers, active30dUsers,
    unreadMessages, unreadThreadsRaw, recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.athleteProfile.count({ where: { onboardingCompletedAt: { not: null } } }),
    prisma.deviceConnection.groupBy({ by: ["userId"], where: { status: "CONNECTED" } }),
    prisma.activity.groupBy({ by: ["userId"] }),
    prisma.activity.groupBy({ by: ["userId"], where: { startedAt: { gte: d7 } } }),
    prisma.activity.groupBy({ by: ["userId"], where: { startedAt: { gte: d30 } } }),
    prisma.supportMessage.count({ where: { fromAdmin: false, read: false } }),
    prisma.supportMessage.findMany({ where: { fromAdmin: false, read: false }, select: { userId: true }, distinct: ["userId"] }),
    prisma.user.findMany({ where: { createdAt: { gte: d14 } }, select: { createdAt: true } }),
  ]);

  const total = Math.max(totalUsers, 1);
  const stages = [
    { key: "registered", label: "Зарегистрировались", count: totalUsers },
    { key: "onboarded", label: "Прошли настройку профиля", count: onboardedUsers },
    { key: "device", label: "Подключили устройство", count: connectedDevices.length },
    { key: "activity", label: "Записали первую тренировку", count: loggedActivity.length },
    { key: "active7d", label: "Активны за 7 дней", count: active7dUsers.length },
  ];
  const funnel: FunnelStage[] = stages.map((s, i) => ({
    ...s,
    percentOfTotal: Math.round((s.count / total) * 100),
    droppedFromPrev: i === 0 ? 0 : Math.max(0, stages[i - 1].count - s.count),
  }));

  const byDay = new Map<string, number>();
  for (const u of recentUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const signupTrend: SignupPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    signupTrend.push({ date: key, label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), count: byDay.get(key) ?? 0 });
  }

  return {
    totalUsers, onboardedUsers, active7d: active7dUsers.length, active30d: active30dUsers.length,
    unreadMessages, unreadThreads: unreadThreadsRaw.length, funnel, signupTrend,
  };
}
