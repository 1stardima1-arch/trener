import { avatarByKey } from "@/lib/avatars";
import { cn } from "@/lib/utils";

// Single source of truth for rendering a user's avatar anywhere in the app:
// picked preset (emoji on gradient) > OAuth photo > first letter of the name.
export function UserAvatar({
  avatarKey,
  image,
  name,
  className,
  emojiClassName,
}: {
  avatarKey?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
  emojiClassName?: string;
}) {
  const preset = avatarByKey(avatarKey);

  return (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full bg-(--color-paper-dim) font-bold",
        className
      )}
      style={preset ? { background: preset.gradient } : undefined}
    >
      {preset ? (
        <span className={emojiClassName}>{preset.emoji}</span>
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        (name ?? "?").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
