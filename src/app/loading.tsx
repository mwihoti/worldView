import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="max-w-7xl w-full px-3 xl:px-0 mx-auto mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="flex flex-col overflow-hidden">
            <CardHeader className="p-0">
              <Skeleton className="aspect-video w-full rounded-none" />
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
