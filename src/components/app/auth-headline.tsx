export function AuthHeadline({ mode }: { mode: "signin" | "signup" }) {
  if (mode === "signup") {
    return (
      <>
        <h1 className="font-display text-center text-2xl font-extrabold">Создать аккаунт</h1>
        <p className="mt-2 text-center text-sm text-(--color-ink-soft)">
          Придумай ник и пароль — данные сохранятся за тобой
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-center text-2xl font-extrabold">Привет 👋</h1>
      <p className="mt-2 text-center text-sm text-(--color-ink-soft)">
        Войди, чтобы увидеть готовность, план и разбор от ИИ-тренера
      </p>
    </>
  );
}
