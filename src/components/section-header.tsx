import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* "LATEST STORIES ………… View all stories →" */
export default function SectionHeader({
  title,
  id,
  href,
  linkLabel,
  className,
  as: Heading = "h2",
}: {
  title: string;
  id?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <Heading id={id} className="section-title">
        {title}
      </Heading>
      {href && linkLabel && (
        <Link href={href} className="more-link text-[0.95rem] font-medium">
          {linkLabel} <ArrowRight className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
