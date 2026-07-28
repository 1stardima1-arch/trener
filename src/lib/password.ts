import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Пароль должен быть не короче 8 символов.";
  if (password.length > 72) return "Пароль слишком длинный.";
  if (!/[a-zA-Zа-яА-Я]/.test(password) || !/[0-9]/.test(password)) {
    return "Пароль должен содержать буквы и цифры.";
  }
  return null;
}
