import { Container } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="py-10 sm:py-16">
      <Container>
        <Reveal>
          <div className="dreamy-hero-bg relative overflow-hidden rounded-[2.5rem] px-6 py-16 text-center sm:px-16 sm:py-24">
            <div className="blob blob-blue" />
            <div className="blob blob-pink" />
            <div className="hill" />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
                Хватит тренироваться вслепую
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-(--color-ink-soft)">
                Подключи устройство и получи первый план уже сегодня — бесплатно, без карты.
              </p>
              <LinkButton href="/login" size="lg" className="mt-8">Начать бесплатно <ArrowRight className="h-5 w-5" /></LinkButton>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
