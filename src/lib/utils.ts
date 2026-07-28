import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Prisma } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Json-typed Prisma columns are frequently fed plain objects/arrays we've
// already built and trust the shape of — this satisfies Prisma's
// InputJsonValue typing at the call site without re-validating it.
export function asJson(v: unknown): Prisma.InputJsonValue | undefined {
  return v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue);
}
