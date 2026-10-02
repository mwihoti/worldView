import Image from "next/image";
import { cn } from "@/lib/utils";

const TINTS = [
  "bg-cat-sports",
  "bg-cat-screen",
  "bg-cat-tech",
  "bg-cat-story",
];

/* A profile picture, or a coloured initial when there isn't one. */
export default function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        style={box}
        className={cn("rounded-full border-2 border-ink object-cover", className)}
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const tint = TINTS[(name.length + initial.charCodeAt(0)) % TINTS.length];
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size * 0.48 }}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full border-2 border-ink font-display font-bold text-white",
        tint,
        className
      )}
    >
      {initial}
    </span>
  );
}
