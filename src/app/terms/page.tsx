import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Container } from "@/components/ui/card";

const CONTACT_EMAIL = process.env.SUPPORT_EMAIL || "support@trener.app";

export const metadata = { title: "Пользовательское соглашение — Тренер" };

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 py-16">
        <Container className="max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Пользовательское соглашение</h1>
          <p className="mt-2 text-sm text-(--color-ink-soft)">Последнее обновление: {new Date().toLocaleDateString("ru-RU")}</p>

          <div className="prose-theory mt-8 space-y-6 text-sm leading-relaxed text-(--color-ink-soft)">
            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">1. Предмет соглашения</h2>
              <p className="mt-2">
                Настоящее соглашение регулирует отношения между сервисом «Тренер» (далее — «Сервис»)
                и пользователем в связи с использованием функций планирования тренировок, анализа
                восстановления, сна и питания, синхронизации со спортивными устройствами и общением
                с ИИ-тренером. По вопросам, связанным с настоящим соглашением, можно обратиться на {CONTACT_EMAIL}.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">2. Не медицинская консультация</h2>
              <p className="mt-2">
                Сервис не является медицинским устройством и не заменяет консультацию врача,
                тренера или диетолога. Рекомендации ИИ-тренера, оценки готовности, тренировочные
                планы и советы по питанию носят информационный характер. При травмах, симптомах
                заболевания, беременности или иных медицинских ограничениях перед началом или
                продолжением тренировок обратись к врачу.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">3. Регистрация и аккаунт</h2>
              <p className="mt-2">
                Доступ к Сервису предоставляется после входа по нику и паролю или по почте
                (ссылкой); на устройствах с поддержкой можно также настроить вход по
                отпечатку/Face ID. Пользователь несёт ответственность за сохранность доступа
                к своему аккаунту, включая пароль и данные подключённых устройств.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">4. Подключение сторонних устройств и сервисов</h2>
              <p className="mt-2">
                Сервис может подключаться к сторонним API (Polar AccessLink, Athyx) по протоколам,
                предоставленным их владельцами, и, опционально, использовать неофициальный способ
                синхронизации с Garmin Connect — пользователь подключает его сам и осознанно, понимая,
                что такой способ не является официальным API Garmin. Сервис не несёт ответственности
                за доступность, точность или изменения в работе сторонних API.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">5. Правила использования</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Запрещено использовать Сервис для действий, нарушающих законодательство РФ.</li>
                <li>Запрещены попытки нарушить работу Сервиса, автоматизированный сбор данных без разрешения.</li>
                <li>Один аккаунт предназначен для использования одним человеком.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">6. Стоимость</h2>
              <p className="mt-2">Сервис предоставляется бесплатно — без подписок и платных тарифов.</p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">7. Ограничение ответственности</h2>
              <p className="mt-2">
                Сервис предоставляется «как есть». Оператор не несёт ответственности за
                результаты тренировок, травмы или иные последствия следования рекомендациям
                Сервиса, а также за временную недоступность Сервиса по техническим причинам.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">8. Прекращение доступа</h2>
              <p className="mt-2">
                Пользователь может удалить аккаунт и все свои данные в любой момент из настроек
                профиля. Оператор вправе ограничить доступ при нарушении настоящего соглашения.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-(--color-ink)">9. Изменения соглашения</h2>
              <p className="mt-2">
                Оператор может обновлять условия соглашения. Продолжение использования
                Сервиса после изменений означает согласие с новой редакцией.
              </p>
            </section>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
