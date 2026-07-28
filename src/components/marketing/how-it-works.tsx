import { Container } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";

const steps = [
  { n: "01", title: "Расскажи о себе", desc: "Вид спорта, возраст, цели, доступное время — за пару минут." },
  { n: "02", title: "Подключи устройство", desc: "Garmin, Polar, Athyx или просто загрузи .fit — определим пороги и VO2max." },
  { n: "03", title: "Тренируйся по плану, который слушает тебя", desc: "Готовность каждый день двигает план — и объясняет, почему именно так." },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Начать можно за пару минут</h2>
        </Reveal>

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1} className="relative">
              <span className="font-display gradient-text text-5xl font-extrabold opacity-70">{s.n}</span>
              <h3 className="font-display mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-(--color-ink-soft)">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
