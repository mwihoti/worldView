import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "../globals.css";
import Masthead from "@/components/masthead";
import NewsletterCard from "@/components/newsletter-card";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import RevealObserver from "@/components/reveal-observer";
import { Toaster } from "@/components/ui/sonner";
import { getPublication, newsletterAvailable } from "@/lib/requests";
import { siteUrl } from "@/lib/env";

/*
 * Two typefaces: Source Serif 4 for headlines and reading (its optical-size
 * axis tightens it at display sizes and opens it up for body text), Inter
 * for the interface. Self-hosted by next/font.
 */
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/*
 * Runs before first paint: marks the page as scripted (so scroll-reveal
 * elements may start hidden) and arms a failsafe that shows everything if
 * the reveal engine never starts.
 */
const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.add('js');setTimeout(function(){if(!window.__revealReady)d.classList.add('reveal-failsafe')},3000)}catch(e){}})()`;

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
      images: [{ url: "/og", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og"],
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
    <html lang="en" suppressHydrationWarning className={`${serif.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        {/* A fresh storage key, so themes saved by the previous design
            (sepia, moss, …) don't leave the page half-styled. */}
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          themes={["light", "dark"]}
          storageKey="wv-theme"
          disableTransitionOnChange
        >
          <a
            href="#main"
            className="sr-only z-[90] rounded bg-card px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <Masthead newsletter={newsletterAvailable} />
          {children}
          {newsletterAvailable && <NewsletterCard />}
          <Footer />
          <Toaster />
          <RevealObserver />
        </ThemeProvider>
      </body>
    </html>
  );
}
