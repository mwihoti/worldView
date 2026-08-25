import { getPublication } from "@/lib/requests";

export default async function Footer() {
  const publication = await getPublication();
  const title = publication.displayTitle || publication.title;

  return (
    <footer className="bg-muted flex items-center justify-center w-full py-4 mt-10">
      <p className="text-muted-foreground text-sm">
        © {new Date().getFullYear()} {title}
      </p>
    </footer>
  );
}
