import { Container } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { HeartPulse, Watch, Moon, Apple, Users, Zap } from "lucide-react";

const features = [
  {
    icon: HeartPulse,
    title: "Пороги и VO2max сами по себе",
    desc: "Лактатные пороги (Dmax/OBLA), порог ЧСС и VO2max определяются из твоих реальных данных — независимо от модели устройства.",
    color: "#4f6bff",
  },
  {
    icon: Watch,
    title: "Реальная синхронизация устройств",
    desc: "Athyx и Polar — по официальным API. Garmin — через .fit-файл или неофициальную синхронизацию, как у открытых проектов на GitHub.",
    color: "#ec4899",
  },
  {
    icon: Zap,
    title: "План меняется и объясняет почему",
    desc: "Плохо спал или тяжело провёл сессию — план на сегодня пересчитывается, и ты всегда видишь, почему именно так.",
    color: "#f59e0b",
  },
  {
    icon: Moon,
    title: "Сон и восстановление",
    desc: "ВСР, пульс покоя и сон превращаются в понятную оценку готовности — как у Whoop, только с полной прозрачностью расчёта.",
    color: "#22c55e",
  },
  {
    icon: Apple,
    title: "Питание под тренировки",
    desc: "Калории и БЖУ на день с учётом объёма тренировки, углеводная периодизация и меню от ИИ под твою диету.",
    color: "#8b5cf6",
  },
  {
    icon: Users,
    title: "Сообщество атлетов",
    desc: "Смотри тренировки и прогресс других — лактат, пороги, тенденцию — подписывайся и сравнивай.",
    color: "#0ea5e9",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Тренер · нутрициолог · биомеханик — в одном ИИ</h2>
          <p className="mt-4 text-(--color-ink-soft)">Обучен на реальной спортивной науке, а не на общих советах.</p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="card-surface h-full p-7 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${f.color}1a` }}>
                  <f.icon className="h-6 w-6" style={{ color: f.color }} strokeWidth={2} />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
