import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="wrap pt-10" aria-busy="true" aria-label="Loading stories">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-16 w-full max-w-2xl" />
      <div className="mt-10 grid grid-cols-1 gap-x-7 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sticker overflow-hidden">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
