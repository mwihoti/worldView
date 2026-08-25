import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import NewsletterCard from "@/components/newsletter-card";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getPublication } from "@/lib/requests";
import { siteUrl } from "@/lib/env";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const publication = await getPublication();
  const title = publication.displayTitle || publication.title;
  const description =
    publication.descriptionSEO ||
    "WorldView — news, sports, movies and tech stories from around the world.";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    icons: publication.favicon ? [{ url: publication.favicon }] : undefined,
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      types: { "application/rss+xml": "/feed.xml" },
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
          <NewsletterCard />
          <Footer />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
