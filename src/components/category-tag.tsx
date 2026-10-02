import { cn } from "@/lib/utils";
import type { Category } from "@/lib/category";

export default function CategoryTag({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <span
      data-cat={category.id}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground",
        className
      )}
    >
      <span className="cat-dot" aria-hidden="true" />
      {category.label}
    </span>
  );
}
