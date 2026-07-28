export function AuthHeadline({ mode }: { mode: "signin" | "signup" }) {
  if (mode === "signup") {
    return (
      <>
        <h1 className="font-display text-center text-3xl font-extrabold tracking-tight text-white">Создать аккаунт</h1>
        <p className="mt-2 text-center text-sm text-white/50">Ник и пароль — этого достаточно, чтобы начать</p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-center text-3xl font-extrabold tracking-tight text-white">С возвращением</h1>
      <p className="mt-2 text-center text-sm text-white/50">Войди, чтобы увидеть готовность, план и разбор от ИИ-тренера</p>
    </>
  );
}
