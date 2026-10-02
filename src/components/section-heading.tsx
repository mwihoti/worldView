import { cn } from "@/lib/utils";

/* Handwritten eyebrow + big serif title, used to open each block of the page. */
export default function SectionHeading({
  eyebrow,
  title,
  className,
  as: Heading = "h2",
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  className?: string;
  /* h1 on pages where this is the page title, h2 for a block within a page. */
  as?: "h1" | "h2";
  children?: React.ReactNode;
}) {
  return (
    <div
      data-reveal
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div>
        <p className="font-hand text-2xl leading-none text-primary">{eyebrow}</p>
        <Heading className="font-display mt-1 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          {title}
        </Heading>
      </div>
      {children}
    </div>
  );
}
