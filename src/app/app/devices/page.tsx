import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AthyxCard, PolarCard, StravaCard, IntervalsIcuCard, GarminCard } from "@/components/app/device-cards";
import { LogLactateForm } from "@/components/app/log-lactate-form";
import { Watch, Upload } from "lucide-react";
import Link from "next/link";

export default async function DevicesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const connections = await prisma.deviceConnection.findMany({ where: { userId } });
  const byProvider = Object.fromEntries(connections.map((c) => [c.provider, {
    status: c.status, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null, lastSyncStatus: c.lastSyncStatus, lastSyncError: c.lastSyncError,
  }]));

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Watch className="h-6 w-6 text-(--color-brand-blue)" /> Устройства</h1>
      <p className="mt-1 text-(--color-ink-soft)">Подключи гаджеты — пороги, VO2max и тенденция определятся автоматически, независимо от модели.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <IntervalsIcuCard conn={byProvider.INTERVALS_ICU ?? null} />
        <StravaCard conn={byProvider.STRAVA ?? null} />
        <AthyxCard conn={byProvider.ATHYX ?? null} />
        <PolarCard conn={byProvider.POLAR ?? null} />
        <GarminCard conn={byProvider.GARMIN_CONNECT ?? null} enabled={process.env.ENABLE_GARMIN_UNOFFICIAL_SYNC === "true"} />
        <LogLactateForm />
      </div>

      <div className="mt-6 card-surface flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 shrink-0 text-(--color-brand-violet)" />
          <div>
            <div className="font-bold">Загрузка .fit-файла</div>
            <p className="text-xs text-(--color-ink-soft)">Работает для Garmin, Polar, Suunto, Wahoo и любых других устройств — без ключей и подключений.</p>
          </div>
        </div>
        <Link href="/app/training" className="press-spring shrink-0 rounded-full bg-black/5 px-4 py-2 text-xs font-bold dark:bg-white/10">Открыть тренировки</Link>
      </div>
    </div>
  );
}
