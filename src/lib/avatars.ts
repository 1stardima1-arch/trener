// Preset avatars a student can pick in the profile: an emoji on a gradient.
// Stored on User.avatarKey; when set it takes priority over the OAuth photo.

export const AVATARS: { key: string; emoji: string; gradient: string }[] = [
  { key: "fox", emoji: "🦊", gradient: "linear-gradient(135deg,#ffb36b,#ff7a59)" },
  { key: "cat", emoji: "🐱", gradient: "linear-gradient(135deg,#a8b8ff,#7a8cff)" },
  { key: "panda", emoji: "🐼", gradient: "linear-gradient(135deg,#c9f0d4,#7ed6a0)" },
  { key: "owl", emoji: "🦉", gradient: "linear-gradient(135deg,#d7c4ff,#a06bff)" },
  { key: "penguin", emoji: "🐧", gradient: "linear-gradient(135deg,#9fd8ff,#5aa2ff)" },
  { key: "tiger", emoji: "🐯", gradient: "linear-gradient(135deg,#ffd36b,#ff9a3d)" },
  { key: "koala", emoji: "🐨", gradient: "linear-gradient(135deg,#c4d7e0,#8fb3c7)" },
  { key: "frog", emoji: "🐸", gradient: "linear-gradient(135deg,#b8f2b0,#5ecf6d)" },
  { key: "unicorn", emoji: "🦄", gradient: "linear-gradient(135deg,#ffc4e8,#c46bff)" },
  { key: "dragon", emoji: "🐲", gradient: "linear-gradient(135deg,#8fe8d0,#3dbf9b)" },
  { key: "rocket", emoji: "🚀", gradient: "linear-gradient(135deg,#b0c8ff,#6a5cff)" },
  { key: "star", emoji: "⭐", gradient: "linear-gradient(135deg,#ffe38a,#ffb64d)" },
  { key: "brain", emoji: "🧠", gradient: "linear-gradient(135deg,#ffb8c8,#ff6b9e)" },
  { key: "fire", emoji: "🔥", gradient: "linear-gradient(135deg,#ffcf8a,#ff7a4d)" },
  { key: "lightning", emoji: "⚡", gradient: "linear-gradient(135deg,#fff3a0,#ffd23d)" },
  { key: "ghost", emoji: "👻", gradient: "linear-gradient(135deg,#e6e4f2,#b8b4d4)" },
];

export function avatarByKey(key: string | null | undefined) {
  if (!key) return null;
  return AVATARS.find((a) => a.key === key) ?? null;
}

// Nickname can be changed at most once per this many days.
export const NAME_CHANGE_COOLDOWN_DAYS = 14;
