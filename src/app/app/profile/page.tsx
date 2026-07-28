import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileEditor } from "@/components/app/profile-editor";
import { AthleteProfileEditor } from "@/components/app/athlete-profile-editor";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { NAME_CHANGE_COOLDOWN_DAYS } from "@/lib/avatars";
import { isAdminSession } from "@/lib/admin";
import { WebAuthnEnroll } from "@/components/app/webauthn-enroll";
import { DeleteAccountCard } from "@/components/app/delete-account-button";
import Link from "next/link";
import { Moon, LifeBuoy, ChevronRight, ShieldCheck, Fingerprint } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;
  const admin = isAdminSession(session);

  const [user, athleteProfile, adminUnread, authenticators] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.athleteProfile.findUnique({ where: { userId } }),
    admin ? prisma.supportMessage.count({ where: { fromAdmin: false, read: false } }) : Promise.resolve(0),
    prisma.authenticator.findMany({ where: { userId }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const nameLockedDaysLeft = user.nameChangedAt ? Math.max(0, Math.ceil(NAME_CHANGE_COOLDOWN_DAYS - (now - user.nameChangedAt.getTime()) / 86_400_000)) : 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Профиль</h1>

      <div className="mt-6">
        <ProfileEditor
          initialName={user.name ?? ""} initialAvatarKey={user.avatarKey} initialBio={user.bio ?? ""} initialIsPublic={user.isPublic}
          image={user.image} nameLockedDaysLeft={nameLockedDaysLeft}
        />
      </div>

      {athleteProfile && (
        <div className="mt-5">
          <AthleteProfileEditor
            initial={{
              primarySport: athleteProfile.primarySport, secondarySports: athleteProfile.secondarySports,
              sex: athleteProfile.sex, birthDate: athleteProfile.birthDate ? athleteProfile.birthDate.toISOString().slice(0, 10) : null,
              heightCm: athleteProfile.heightCm, weightKg: athleteProfile.weightKg, bodyFatPercent: athleteProfile.bodyFatPercent,
              restingHrManual: athleteProfile.restingHrManual, maxHrManual: athleteProfile.maxHrManual, lthrManual: athleteProfile.lthrManual,
              bloodPressureSystolic: athleteProfile.bloodPressureSystolic, bloodPressureDiastolic: athleteProfile.bloodPressureDiastolic,
              ferritinNgMl: athleteProfile.ferritinNgMl, vitaminDNgMl: athleteProfile.vitaminDNgMl,
              testosteroneNgDl: athleteProfile.testosteroneNgDl, restingGlucoseMgDl: athleteProfile.restingGlucoseMgDl,
              biomarkerNotes: athleteProfile.biomarkerNotes,
              goalType: athleteProfile.goalType, goalEventName: athleteProfile.goalEventName,
              goalEventDate: athleteProfile.goalEventDate ? athleteProfile.goalEventDate.toISOString().slice(0, 10) : null,
              goalNotes: athleteProfile.goalNotes, experienceYears: athleteProfile.experienceYears,
              weeklyAvailabilityMin: (athleteProfile.weeklyAvailabilityMin as Record<string, number>) ?? {},
              sleepGoalHours: athleteProfile.sleepGoalHours, typicalBedtime: athleteProfile.typicalBedtime, typicalWakeTime: athleteProfile.typicalWakeTime,
              dietType: athleteProfile.dietType, allergies: athleteProfile.allergies, dislikedFoods: athleteProfile.dislikedFoods,
              mealsPerDay: athleteProfile.mealsPerDay,
              sportsNutritionOk: athleteProfile.sportsNutritionOk, unitPreference: athleteProfile.unitPreference,
            }}
          />
        </div>
      )}

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Настройки</h2>
      <div className="mt-3 space-y-2.5">
        <div className="card-surface flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-sky-2) text-(--color-brand-blue)"><Moon className="h-4.5 w-4.5" /></span>
            <div><div className="text-sm font-bold">Тёмная тема</div><div className="text-xs text-(--color-ink-soft)">Переключается сразу, запоминается на этом устройстве</div></div>
          </div>
          <ThemeToggle />
        </div>

        <div className="card-surface p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-sky-2) text-(--color-brand-blue)"><Fingerprint className="h-4.5 w-4.5" /></span>
            <div><div className="text-sm font-bold">Вход по отпечатку</div><div className="text-xs text-(--color-ink-soft)">Быстрый вход без пароля на этом устройстве</div></div>
          </div>
          <div className="mt-3.5 pl-[3.25rem]">
            <WebAuthnEnroll devices={authenticators.map((a) => ({ id: a.id, createdAt: a.createdAt.toISOString() }))} />
          </div>
        </div>

        <Link href="/app/support" className="card-surface press-spring flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-(--color-brand-green)"><LifeBuoy className="h-4.5 w-4.5" /></span>
            <div><div className="text-sm font-bold">Поддержка</div><div className="text-xs text-(--color-ink-soft)">Вопрос, идея или что-то не работает — напиши нам</div></div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-(--color-ink-soft)" />
        </Link>

        {admin && (
          <Link href="/app/admin/support" className="card-surface press-spring flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-sky-2) text-(--color-brand-violet)"><ShieldCheck className="h-4.5 w-4.5" /></span>
              <div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  Сообщения пользователей
                  {adminUnread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-(--color-brand-pink) px-1.5 text-[0.65rem] font-bold text-white">{adminUnread}</span>}
                </div>
                <div className="text-xs text-(--color-ink-soft)">Админ-режим — видно только тебе</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-(--color-ink-soft)" />
          </Link>
        )}

        <DeleteAccountCard confirmTarget={user.username ?? user.email ?? ""} />
      </div>
    </div>
  );
}
