"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { completeOnboarding, type OnboardingInput } from "@/lib/actions/onboarding";
import { SPORTS, GOAL_TYPES, DIET_TYPES, WEEKDAYS, WEEKDAY_LABELS, sportDef } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { IntroParticles, IntroBadge, StaggerTitle } from "@/components/app/intro-fx";

const SEEN_FLAG = "trener-onboarded-v2";

const SLIDES = [
  { color: "#4f6bff", emoji: "👋", title: "Привет! Это Тренер", text: "ИИ-тренер, который строит план сна, тренировок и питания под тебя — и объясняет каждое решение." },
  { color: "#22c55e", emoji: "🔋", title: "Готовность каждый день", text: "ВСР, пульс покоя, сон, пороги и даже биохимия крови — превращаются в понятный план на сегодня." },
  { color: "#8b5cf6", emoji: "🔗", title: "Garmin, Polar, Athyx", text: "Подключи устройства или загрузи .fit-файл — приложение само определит твои пороги и VO2max." },
];

type Phase = "slides" | "sport" | "body" | "thresholds" | "biochem" | "goal" | "schedule" | "nutrition";
const PHASE_ORDER: Phase[] = ["sport", "body", "thresholds", "biochem", "goal", "schedule", "nutrition"];
const PHASE_COLOR: Record<Phase, string> = {
  slides: "#4f6bff", sport: "#4f6bff", body: "#ec4899", thresholds: "#f59e0b",
  biochem: "#0ea5e9", goal: "#22c55e", schedule: "#8b5cf6", nutrition: "#14b8a6",
};

const AVAILABILITY_PRESETS = [0, 30, 45, 60, 90, 120];

export function Onboarding({ needsSetup }: { needsSetup: boolean }) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("slides");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [sport, setSport] = useState<string | null>(null);
  const [sex, setSex] = useState<OnboardingInput["sex"]>(null);
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");

  const [hasKnownThresholds, setHasKnownThresholds] = useState(false);
  const [knownLthr, setKnownLthr] = useState("");
  const [knownPace, setKnownPace] = useState(""); // MM:SS per km
  const [knownPower, setKnownPower] = useState("");
  const [knownLt2Mmol, setKnownLt2Mmol] = useState("");
  const [knownVo2max, setKnownVo2max] = useState("");

  const [hasBiochem, setHasBiochem] = useState(false);
  const [ferritin, setFerritin] = useState("");
  const [vitaminD, setVitaminD] = useState("");
  const [testosterone, setTestosterone] = useState("");
  const [glucose, setGlucose] = useState("");
  const [biomarkerNotes, setBiomarkerNotes] = useState("");

  const [goalType, setGoalType] = useState<string | null>(null);
  const [goalEventName, setGoalEventName] = useState("");
  const [goalEventDate, setGoalEventDate] = useState("");
  const [experienceYears, setExperienceYears] = useState("");

  const [availability, setAvailability] = useState<Record<string, number>>({ mon: 45, tue: 0, wed: 45, thu: 0, fri: 45, sat: 60, sun: 0 });
  const [sleepGoal, setSleepGoal] = useState(8);
  const [bedtime, setBedtime] = useState("23:00");
  const [waketime, setWaketime] = useState("07:00");

  const [dietType, setDietType] = useState<string | null>(null);
  const [allergies, setAllergies] = useState("");
  const [dislikedFoods, setDislikedFoods] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [sportsNutritionOk, setSportsNutritionOk] = useState(true);

  useEffect(() => {
    const slidesNeeded = !localStorage.getItem(SEEN_FLAG);
    if (slidesNeeded || needsSetup) {
      const id = requestAnimationFrame(() => {
        setPhase("slides");
        setVisible(true);
      });
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const slide = SLIDES[step];
  const bg = phase === "slides" ? slide.color : PHASE_COLOR[phase];
  const lastSlide = step === SLIDES.length - 1;
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  function closeAll() {
    localStorage.setItem(SEEN_FLAG, "1");
    setVisible(false);
  }

  function nextFromSlides() {
    if (!lastSlide) return setStep((s) => s + 1);
    localStorage.setItem(SEEN_FLAG, "1");
    if (needsSetup) setPhase("sport");
    else setVisible(false);
  }

  function goNext() {
    const next = PHASE_ORDER[phaseIndex + 1];
    if (next) setPhase(next);
    else submit();
  }
  function goBack() {
    const prev = PHASE_ORDER[phaseIndex - 1];
    if (prev) setPhase(prev);
  }

  function parsePace(mmss: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(mmss.trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function submit() {
    if (!sport) return;
    setError(null);
    const input: OnboardingInput = {
      primarySport: sport, sex, birthDate: birthDate || null,
      heightCm: heightCm ? Number(heightCm) : null, weightKg: weightKg ? Number(weightKg) : null,
      bodyFatPercent: bodyFatPercent ? Number(bodyFatPercent) : null,
      restingHrManual: restingHr ? Number(restingHr) : null, maxHrManual: maxHr ? Number(maxHr) : null,
      bloodPressureSystolic: bpSys ? Number(bpSys) : null, bloodPressureDiastolic: bpDia ? Number(bpDia) : null,
      knownLthrBpm: hasKnownThresholds && knownLthr ? Number(knownLthr) : null,
      knownLt2PaceSecPerKm: hasKnownThresholds ? parsePace(knownPace) : null,
      knownLt2PowerW: hasKnownThresholds && knownPower ? Number(knownPower) : null,
      knownLt2Mmol: hasKnownThresholds && knownLt2Mmol ? Number(knownLt2Mmol) : null,
      knownVo2max: hasKnownThresholds && knownVo2max ? Number(knownVo2max) : null,
      ferritinNgMl: hasBiochem && ferritin ? Number(ferritin) : null,
      vitaminDNgMl: hasBiochem && vitaminD ? Number(vitaminD) : null,
      testosteroneNgDl: hasBiochem && testosterone ? Number(testosterone) : null,
      restingGlucoseMgDl: hasBiochem && glucose ? Number(glucose) : null,
      biomarkerNotes: hasBiochem && biomarkerNotes ? biomarkerNotes : null,
      goalType, goalEventName: goalEventName || null, goalEventDate: goalEventDate || null,
      experienceYears: experienceYears ? Number(experienceYears) : null,
      weeklyAvailabilityMin: availability, sleepGoalHours: sleepGoal,
      typicalBedtime: bedtime || null, typicalWakeTime: waketime || null,
      dietType, allergies: allergies || null, dislikedFoods: dislikedFoods || null,
      mealsPerDay, sportsNutritionOk,
    };
    startTransition(async () => {
      const res = await completeOnboarding(input);
      if (res.ok) closeAll();
      else setError(res.error ?? "Не получилось сохранить — попробуй ещё раз.");
    });
  }

  const sd = sport ? sportDef(sport) : null;

  return (
    <motion.div
      className="fixed inset-0 z-90 flex flex-col overflow-hidden text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, backgroundColor: bg }}
      transition={{ backgroundColor: { duration: 0.7, ease: "easeInOut" }, opacity: { duration: 0.4 } }}
      style={{ backgroundColor: bg }}
    >
      <div className="blob-morph absolute left-[-18%] top-[-12%] h-[55vw] w-[55vw] max-h-[420px] max-w-[420px]" />
      <div className="blob-morph blob-morph-2 absolute right-[-15%] top-[30%] h-[48vw] w-[48vw] max-h-[380px] max-w-[380px]" />
      <div className="blob-morph blob-morph-3 absolute bottom-[-16%] left-[10%] h-[50vw] w-[50vw] max-h-[400px] max-w-[400px]" />
      {phase === "slides" && <IntroParticles />}

      {phase === "slides" && !needsSetup && (
        <button onClick={closeAll} className="press-spring absolute right-5 top-5 z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
          Пропустить
        </button>
      )}

      {phase !== "slides" && (
        <div className="relative z-10 flex items-center justify-between px-5 pt-5">
          <button onClick={goBack} className="press-spring flex items-center gap-1 text-sm font-semibold text-white/70">
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <div className="flex gap-1.5">
            {PHASE_ORDER.map((p, i) => (
              <span key={p} className={cn("h-1.5 rounded-full transition-all", i === phaseIndex ? "w-6 bg-white" : i < phaseIndex ? "w-1.5 bg-white/70" : "w-1.5 bg-white/25")} />
            ))}
          </div>
          <span className="text-xs font-bold text-white/60">{phaseIndex + 1}/{PHASE_ORDER.length}</span>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center">
        <AnimatePresence mode="wait">
          {phase === "slides" && (
            <motion.div key={`slide-${step}`} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.95 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className="my-auto flex flex-col items-center">
              <IntroBadge emoji={slide.emoji} />
              <StaggerTitle text={slide.title} className="font-display max-w-sm text-3xl font-extrabold sm:text-4xl" />
              <motion.p initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} className="mt-4 max-w-sm text-lg leading-relaxed text-white/85">
                {slide.text}
              </motion.p>
            </motion.div>
          )}

          {phase === "sport" && (
            <StepCard key="sport" title="Твой основной вид спорта?" subtitle="Определит зоны, план и терминологию.">
              <div className="grid w-full grid-cols-2 gap-2.5">
                {SPORTS.map((s) => (
                  <Choice key={s.slug} active={sport === s.slug} onClick={() => { setSport(s.slug); goNext(); }}>
                    <span className="text-3xl">{s.emoji}</span>
                    <span className="text-sm font-bold">{s.label}</span>
                  </Choice>
                ))}
              </div>
            </StepCard>
          )}

          {phase === "body" && (
            <StepCard key="body" title="Расскажи о теле" subtitle="Возраст, физиология — чем точнее, тем точнее план. Всё необязательно.">
              <div className="grid w-full grid-cols-2 gap-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                <Field label="Пол">
                  <select value={sex ?? ""} onChange={(e) => setSex((e.target.value || null) as OnboardingInput["sex"])} className="onboarding-input">
                    <option value="">Не указано</option><option value="MALE">Мужской</option><option value="FEMALE">Женский</option><option value="OTHER">Другое</option>
                  </select>
                </Field>
                <Field label="Дата рождения"><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="onboarding-input" /></Field>
                <Field label="Рост, см"><input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="onboarding-input" placeholder="175" /></Field>
                <Field label="Вес, кг"><input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="onboarding-input" placeholder="70" /></Field>
                <Field label="% жира (если знаешь)"><input type="number" value={bodyFatPercent} onChange={(e) => setBodyFatPercent(e.target.value)} className="onboarding-input" /></Field>
                <Field label="Стаж в спорте, лет"><input type="number" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className="onboarding-input" /></Field>
                <Field label="Пульс покоя"><input type="number" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} className="onboarding-input" placeholder="если знаешь" /></Field>
                <Field label="Макс. пульс"><input type="number" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} className="onboarding-input" placeholder="если знаешь" /></Field>
                <Field label="Давление, сист."><input type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)} className="onboarding-input" placeholder="120" /></Field>
                <Field label="Давление, диаст."><input type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)} className="onboarding-input" placeholder="80" /></Field>
              </div>
              <NextButton onClick={goNext} color={bg} />
            </StepCard>
          )}

          {phase === "thresholds" && (
            <StepCard key="thresholds" title="Уже знаешь свои пороги?" subtitle="Если проходил(а) степ-тест на лактат или ЧСС-тест — укажи результат, применим его сразу. Нет — просто пропусти, определим сами по данным устройств.">
              <label className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-4 text-left backdrop-blur-sm">
                <input type="checkbox" checked={hasKnownThresholds} onChange={(e) => setHasKnownThresholds(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-semibold">Да, есть результаты теста</span>
              </label>
              {hasKnownThresholds && (
                <div className="mt-3 grid w-full grid-cols-2 gap-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                  <Field label="Порог ЧСС (LTHR)"><input type="number" value={knownLthr} onChange={(e) => setKnownLthr(e.target.value)} className="onboarding-input" placeholder="уд/мин" /></Field>
                  <Field label="Лактат на пороге"><input type="number" step="0.1" value={knownLt2Mmol} onChange={(e) => setKnownLt2Mmol(e.target.value)} className="onboarding-input" placeholder="ммоль/л" /></Field>
                  {sd?.usesPace && <Field label="Темп на пороге (мин/км)"><input value={knownPace} onChange={(e) => setKnownPace(e.target.value)} className="onboarding-input" placeholder="4:30" /></Field>}
                  {sd?.usesPower && <Field label="Мощность на пороге (FTP)"><input type="number" value={knownPower} onChange={(e) => setKnownPower(e.target.value)} className="onboarding-input" placeholder="Вт" /></Field>}
                  <Field label="VO2max (если знаешь)"><input type="number" value={knownVo2max} onChange={(e) => setKnownVo2max(e.target.value)} className="onboarding-input" placeholder="мл/кг/мин" /></Field>
                </div>
              )}
              <NextButton onClick={goNext} color={bg} />
            </StepCard>
          )}

          {phase === "biochem" && (
            <StepCard key="biochem" title="Биохимия крови" subtitle="Полностью по желанию — если есть свежие анализы, ИИ-тренер будет их учитывать в советах.">
              <label className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-4 text-left backdrop-blur-sm">
                <input type="checkbox" checked={hasBiochem} onChange={(e) => setHasBiochem(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-semibold">Да, хочу указать показатели</span>
              </label>
              {hasBiochem && (
                <div className="mt-3 w-full space-y-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ферритин, нг/мл"><input type="number" value={ferritin} onChange={(e) => setFerritin(e.target.value)} className="onboarding-input" /></Field>
                    <Field label="Витамин D, нг/мл"><input type="number" value={vitaminD} onChange={(e) => setVitaminD(e.target.value)} className="onboarding-input" /></Field>
                    <Field label="Тестостерон, нг/дл"><input type="number" value={testosterone} onChange={(e) => setTestosterone(e.target.value)} className="onboarding-input" /></Field>
                    <Field label="Глюкоза натощак, мг/дл"><input type="number" value={glucose} onChange={(e) => setGlucose(e.target.value)} className="onboarding-input" /></Field>
                  </div>
                  <Field label="Другое"><textarea value={biomarkerNotes} onChange={(e) => setBiomarkerNotes(e.target.value)} rows={2} className="onboarding-input w-full" placeholder="Любые другие показатели анализов" /></Field>
                </div>
              )}
              <NextButton onClick={goNext} color={bg} />
            </StepCard>
          )}

          {phase === "goal" && (
            <StepCard key="goal" title="Твоя цель" subtitle="Определит периодизацию плана.">
              <div className="grid w-full grid-cols-2 gap-2.5">
                {GOAL_TYPES.map((g) => (
                  <Choice key={g.key} active={goalType === g.key} onClick={() => setGoalType(g.key)}>
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-xs font-bold">{g.title}</span>
                  </Choice>
                ))}
              </div>
              {goalType === "RACE" && (
                <div className="mt-3 grid w-full grid-cols-2 gap-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                  <Field label="Название старта"><input value={goalEventName} onChange={(e) => setGoalEventName(e.target.value)} className="onboarding-input" placeholder="Марафон..." /></Field>
                  <Field label="Дата старта"><input type="date" value={goalEventDate} onChange={(e) => setGoalEventDate(e.target.value)} className="onboarding-input" /></Field>
                </div>
              )}
              <NextButton onClick={goNext} color={bg} disabled={!goalType} />
            </StepCard>
          )}

          {phase === "schedule" && (
            <StepCard key="schedule" title="Режим сна и тренировок" subtitle="Когда можешь тренироваться и как обычно спишь.">
              <div className="grid w-full grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button key={d} type="button" onClick={() => setAvailability((prev) => ({ ...prev, [d]: AVAILABILITY_PRESETS[(AVAILABILITY_PRESETS.indexOf(prev[d] ?? 0) + 1) % AVAILABILITY_PRESETS.length] }))} className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-bold", (availability[d] ?? 0) > 0 ? "bg-white text-(--color-ink)" : "bg-white/10 text-white/60")}>
                    {WEEKDAY_LABELS[d]}<span className="text-[0.65rem] font-semibold">{availability[d] ?? 0}м</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[0.7rem] text-white/50">Нажимай, чтобы менять минуты (0→30→45→60→90→120)</p>
              <div className="mt-3 grid w-full grid-cols-3 gap-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                <Field label="Цель сна, ч"><input type="number" step="0.5" value={sleepGoal} onChange={(e) => setSleepGoal(Number(e.target.value))} className="onboarding-input" /></Field>
                <Field label="Обычный отбой"><input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="onboarding-input" /></Field>
                <Field label="Обычный подъём"><input type="time" value={waketime} onChange={(e) => setWaketime(e.target.value)} className="onboarding-input" /></Field>
              </div>
              <NextButton onClick={goNext} color={bg} disabled={!Object.values(availability).some((v) => v > 0)} />
            </StepCard>
          )}

          {phase === "nutrition" && (
            <StepCard key="nutrition" title="Питание" subtitle="Обычное и спортивное — план питания подстроится под тренировки.">
              <div className="flex w-full flex-wrap gap-2">
                {DIET_TYPES.map((d) => (
                  <button key={d.key} type="button" onClick={() => setDietType(d.key)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", dietType === d.key ? "bg-white text-(--color-ink)" : "bg-white/15 hover:bg-white/25")}>{d.label}</button>
                ))}
              </div>
              <div className="mt-3 w-full space-y-3 rounded-3xl bg-white/10 p-5 text-left backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Приёмов пищи в день"><input type="number" min={1} max={10} value={mealsPerDay} onChange={(e) => setMealsPerDay(Number(e.target.value))} className="onboarding-input" /></Field>
                  <label className="mt-5 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sportsNutritionOk} onChange={(e) => setSportsNutritionOk(e.target.checked)} />
                    Ок со спортпитом (гели/изотоники)
                  </label>
                </div>
                <Field label="Аллергии/непереносимости"><input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="onboarding-input w-full" /></Field>
                <Field label="Не любимые продукты"><input value={dislikedFoods} onChange={(e) => setDislikedFoods(e.target.value)} className="onboarding-input w-full" /></Field>
              </div>
              {error && <p className="mt-3 text-sm font-semibold text-white">{error}</p>}
              <motion.button whileTap={{ scale: 0.96 }} disabled={isPending} onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-display text-base font-bold text-(--color-ink) shadow-[0_12px_32px_rgba(0,0,0,0.25)] disabled:opacity-60">
                {isPending ? "Настраиваю…" : "Начать"} <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </motion.button>
            </StepCard>
          )}
        </AnimatePresence>
      </div>

      {phase === "slides" && (
        <div className="relative z-10 flex flex-col items-center gap-6 pb-10">
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <motion.span key={i} className="h-2 rounded-full bg-white" animate={{ width: i === step ? 24 : 8, opacity: i === step ? 1 : 0.45 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            ))}
          </div>
          <motion.button onClick={nextFromSlides} whileTap={{ scale: 0.94 }} className="flex items-center gap-2 rounded-full bg-white px-10 py-4 font-display text-base font-bold shadow-[0_12px_32px_rgba(0,0,0,0.18)]" style={{ color: bg }}>
            {lastSlide ? (needsSetup ? "Настроить под себя" : "Погнали") : "Дальше"}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </motion.button>
        </div>
      )}

      <style>{`.onboarding-input{width:100%;border-radius:0.9rem;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);padding:0.55rem 0.8rem;font-size:0.85rem;color:white;outline:none}.onboarding-input::placeholder{color:rgba(255,255,255,0.45)}.onboarding-input option{color:black}`}</style>
    </motion.div>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="my-auto flex w-full max-w-lg flex-col items-center"
    >
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-sm text-sm text-white/75">{subtitle}</p>}
      <div className="mt-6 flex w-full flex-col items-center">{children}</div>
    </motion.div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onClick} className={cn("flex flex-col items-center gap-1.5 rounded-2xl p-4 text-center backdrop-blur-sm transition-colors", active ? "bg-white text-(--color-ink)" : "bg-white/15 hover:bg-white/25")}>
      {children}
    </motion.button>
  );
}

function NextButton({ onClick, color, disabled }: { onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.96 }} disabled={disabled} onClick={onClick} className="mt-5 flex items-center gap-2 rounded-full bg-white px-10 py-3.5 font-display text-sm font-bold shadow-[0_12px_32px_rgba(0,0,0,0.2)] disabled:opacity-50" style={{ color }}>
      Дальше <ArrowRight className="h-4.5 w-4.5" strokeWidth={2.5} />
    </motion.button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] font-bold uppercase tracking-wide text-white/60">{label}</span>
      {children}
    </label>
  );
}
