import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="wrap pb-20 pt-10 lg:pt-12" aria-busy="true" aria-label="Loading stories">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="grid gap-10 md:grid-cols-[1.12fr_1fr] lg:pr-12">
          <Skeleton className="aspect-[16/10.2] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="space-y-6 lg:border-l lg:border-border lg:pl-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-14 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="story-card">
            <Skeleton className="aspect-[16/7] w-full rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
