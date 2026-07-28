import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeTdee, computeMacroTargets, computeHydrationTargetMl } from "@/lib/physiology/nutrition";
import { NutritionLogForm } from "@/components/app/nutrition-log-form";
import { MealSuggestions } from "@/components/app/meal-suggestions";
import { Apple, Droplets } from "lucide-react";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default async function NutritionPage() {
  const session = await auth();
  const userId = session!.user.id;
  const { start, end } = todayRange();

  const [profile, planItem, logs] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.planItem.findFirst({ where: { userId, date: new Date(start.toISOString().slice(0, 10)) } }),
    prisma.nutritionLog.findMany({ where: { userId, loggedAt: { gte: start, lte: end } }, orderBy: { loggedAt: "desc" } }),
  ]);

  if (!profile?.weightKg || !profile.heightCm || !profile.birthDate || !profile.sex) {
    return (
      <div className="card-surface p-8 text-center">
        <Apple className="mx-auto h-8 w-8 text-(--color-brand-green)" />
        <p className="mt-3 text-(--color-ink-soft)">Заполни рост, вес, дату рождения и пол в профиле — тогда посчитаем твою норму калорий и БЖУ.</p>
      </div>
    );
  }

  const age = new Date().getFullYear() - profile.birthDate.getFullYear();
  const trainingMinutes = planItem?.targetDurationSec ? planItem.targetDurationSec / 60 : 0;

  const tdee = computeTdee({ weightKg: profile.weightKg, heightCm: profile.heightCm, age, sex: profile.sex, bodyFatPercent: profile.bodyFatPercent, todaysTrainingDurationMin: trainingMinutes });
  const macros = computeMacroTargets({ weightKg: profile.weightKg, tdeeKcal: tdee.tdeeKcal, goalType: profile.goalType, todaysTrainingLoadMinutes: trainingMinutes });
  const hydrationMl = computeHydrationTargetMl(profile.weightKg, trainingMinutes);

  const loggedKcal = logs.reduce((a, l) => a + (l.kcal ?? 0), 0);

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Apple className="h-6 w-6 text-(--color-brand-green)" /> Питание</h1>
      <p className="mt-1 text-(--color-ink-soft)">Норма на сегодня, с учётом {trainingMinutes > 0 ? `тренировки (${Math.round(trainingMinutes)} мин)` : "дня отдыха"}.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-surface p-5"><div className="text-xs font-bold uppercase text-(--color-ink-soft)">Калории</div><div className="font-display mt-1 text-2xl font-extrabold">{macros.kcal}</div></div>
        <div className="card-surface p-5"><div className="text-xs font-bold uppercase text-(--color-ink-soft)">Белки</div><div className="font-display mt-1 text-2xl font-extrabold">{macros.proteinG}г</div></div>
        <div className="card-surface p-5"><div className="text-xs font-bold uppercase text-(--color-ink-soft)">Углеводы</div><div className="font-display mt-1 text-2xl font-extrabold">{macros.carbsG}г</div><div className="text-xs text-(--color-ink-soft)">{macros.carbLoad === "HIGH" ? "высокая загрузка" : macros.carbLoad === "MODERATE" ? "средняя" : "низкая"}</div></div>
        <div className="card-surface p-5"><div className="text-xs font-bold uppercase text-(--color-ink-soft)">Жиры</div><div className="font-display mt-1 text-2xl font-extrabold">{macros.fatG}г</div></div>
      </div>

      <div className="mt-4 card-surface flex items-center gap-3 p-4">
        <Droplets className="h-5 w-5 shrink-0 text-(--color-brand-blue)" />
        <div className="text-sm"><span className="font-bold">{(hydrationMl / 1000).toFixed(1)} л</span> <span className="text-(--color-ink-soft)">вода на сегодня (базово + компенсация тренировки)</span></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">ИИ подскажет меню</h2>
          <MealSuggestions targets={macros} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Записать приём пищи</h2>
          <NutritionLogForm />
          {logs.length > 0 && (
            <div className="mt-4 space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="card-surface p-3.5 text-sm">
                  <div className="font-semibold">{l.mealName}</div>
                  <div className="text-(--color-ink-soft)">{l.description}</div>
                </div>
              ))}
              {loggedKcal > 0 && <div className="text-xs text-(--color-ink-soft)">Записано сегодня: ~{loggedKcal} ккал</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
