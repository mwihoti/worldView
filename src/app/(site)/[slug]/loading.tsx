import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="wrap pt-10 lg:pt-14" aria-busy="true" aria-label="Loading story">
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-6 w-full" />
      </div>
      <Skeleton className="mx-auto mt-9 aspect-[16/9] max-w-5xl" />
      <div className="mx-auto mt-12 max-w-[42rem] space-y-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>
    </main>
  );
}
