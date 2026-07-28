"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function AnimatedBar({
  percent,
  color,
  className,
  trackClassName,
}: {
  percent: number;
  color?: string;
  className?: string;
  trackClassName?: string;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-black/10", trackClassName)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", className)}
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}
