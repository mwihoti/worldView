import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="wrap pt-10" aria-busy="true" aria-label="Loading story">
      <div className="mx-auto max-w-3xl space-y-5 text-center">
        <Skeleton className="mx-auto h-7 w-44 rounded-full" />
        <Skeleton className="mx-auto h-14 w-full" />
        <Skeleton className="mx-auto h-14 w-2/3" />
      </div>
      <Skeleton className="sticker mx-auto mt-10 aspect-[16/9] max-w-4xl" />
      <div className="mx-auto mt-14 max-w-[40em] space-y-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>
    </main>
  );
}
