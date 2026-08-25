import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="max-w-7xl w-full px-3 xl:px-0 mx-auto my-20 flex flex-col items-center gap-5">
      <h2 className="text-4xl font-bold">404</h2>
      <p className="text-muted-foreground">
        This page could not be found.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
