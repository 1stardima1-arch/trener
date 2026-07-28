import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        // Back to the login screen, not the marketing homepage — inside the
        // installed app, landing on the marketing site after sign-out would
        // break the standalone feel.
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="flex h-9 w-9 items-center justify-center rounded-full text-(--color-ink-soft) transition-colors hover:bg-black/5 hover:text-(--color-ink)"
        title="Выйти"
      >
        <LogOut className="h-4.5 w-4.5" />
      </button>
    </form>
  );
}
