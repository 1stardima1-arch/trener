import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rollingBaseline } from "@/lib/physiology/recovery";
import { checkRespiratoryRate, checkSpo2, checkBaseline, checkSkinTemp, checkBloodPressure } from "@/lib/physiology/health-ranges";
import { HealthTabs } from "@/components/app/health-tabs";
import { Activity } from "lucide-react";

export default async function HealthPage() {
  const session = await auth();
  const userId = session!.user.id;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [metrics, profile] = await Promise.all([
    prisma.dailyMetric.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.athleteProfile.findUnique({ where: { userId } }),
  ]);

  const rows = metrics.map((m) => ({
    date: m.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    hrv: m.hrvMs, restingHr: m.restingHr, respiratoryRate: m.respiratoryRate, spo2: m.spo2,
    skinTempDeviationC: m.skinTempDeviationC, recoveryScore: m.recoveryScore, strain: m.strain,
    sleepHours: m.sleepDurationSec ? Math.round((m.sleepDurationSec / 3600) * 10) / 10 : null,
    sleepScore: m.sleepScore,
  }));

  const hrvBaseline = rollingBaseline(metrics.map((m) => m.hrvMs).filter((v): v is number => v != null));
  const rhrBaseline = rollingBaseline(metrics.map((m) => m.restingHr).filter((v): v is number => v != null));
  const latest = metrics.at(-1);

  const bloodPressureLabel = profile?.bloodPressureSystolic && profile?.bloodPressureDiastolic ? `${profile.bloodPressureSystolic}/${profile.bloodPressureDiastolic}` : "—";

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Activity className="h-6 w-6 text-(--color-brand-pink)" /> Health Monitor</h1>
      <p className="mt-1 text-(--color-ink-soft)">Все показатели здоровья в одном месте, за последние 30 дней.</p>

      <div className="mt-6">
        <HealthTabs
          rows={rows}
          latestHr={latest?.restingHr ?? null}
          bloodPressureLabel={bloodPressureLabel}
          sleepGoalHours={profile?.sleepGoalHours ?? 8}
          checks={{
            respiratoryRate: checkRespiratoryRate(latest?.respiratoryRate ?? null),
            spo2: checkSpo2(latest?.spo2 ?? null),
            restingHr: checkBaseline(latest?.restingHr ?? null, rhrBaseline),
            hrv: checkBaseline(latest?.hrvMs ?? null, hrvBaseline),
            skinTemp: checkSkinTemp(latest?.skinTempDeviationC ?? null),
            bloodPressure: checkBloodPressure(profile?.bloodPressureSystolic ?? null, profile?.bloodPressureDiastolic ?? null),
          }}
        />
      </div>
    </div>
  );
}
