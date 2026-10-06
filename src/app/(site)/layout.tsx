import type { Metadata } from "next";
import { Bricolage_Grotesque, Caveat, Fraunces, Newsreader } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/navbar";
import NewsletterCard from "@/components/newsletter-card";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import RevealObserver from "@/components/reveal-observer";
import { Toaster } from "@/components/ui/sonner";
import { getPublication, newsletterAvailable } from "@/lib/requests";
import { siteUrl } from "@/lib/env";

/*
 * Four voices: Fraunces (soft, slightly wonky serif) for headlines,
 * Newsreader for long reading, Bricolage Grotesque for interface text and
 * labels, Caveat for the handwritten margin notes. Self-hosted by next/font.
 */
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
// Only article pages read in Newsreader, so don't make every visit preload it.
const body = Newsreader({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  style: ["normal", "italic"],
  preload: false,
});
// SOFT and WONK are what give the headlines their hand-made character; the
// optical-size axis would add weight for little visible gain, so it is left out.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
  style: ["normal", "italic"],
});
const note = Caveat({ subsets: ["latin"], variable: "--font-note", display: "swap" });

/*
 * Runs before first paint: marks the page as scripted (so scroll-reveal
 * elements may start hidden), restores the reader's text size and typeface,
 * and arms a failsafe that shows everything if the reveal engine never
 * starts. The theme itself is restored by next-themes' own script.
 */
const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.add('js');var s=localStorage.getItem('wv-size'),f=localStorage.getItem('wv-font');if(s)d.dataset.size=s;if(f)d.dataset.font=f;setTimeout(function(){if(!window.__revealReady)d.classList.add('reveal-failsafe')},3500)}catch(e){}})()`;

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ui.variable} ${body.variable} ${display.variable} ${note.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "sepia", "moss", "blueprint"]}
          disableTransitionOnChange
        >
          <a
            href="#main"
            className="sr-only z-[90] rounded-full border-2 border-ink bg-card px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <Navbar />
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
