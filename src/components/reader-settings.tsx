"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import { useTheme } from "next-themes";
import { Check, Monitor, Palette, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "light", name: "Paper", hint: "Warm daylight" },
  { id: "sepia", name: "Sepia", hint: "Easy on the eyes" },
  { id: "moss", name: "Moss", hint: "Field-notes green" },
  { id: "dark", name: "Ink", hint: "Cosy night mode" },
  { id: "blueprint", name: "Blueprint", hint: "Drafting-table blue" },
] as const;

const SIZES = [
  { id: "s", label: "Small", scale: "text-sm" },
  { id: "m", label: "Medium", scale: "text-lg" },
  { id: "l", label: "Large", scale: "text-2xl" },
] as const;

const FONTS = [
  { id: "serif", label: "Serif", className: "font-serif" },
  { id: "sans", label: "Sans", className: "font-sans" },
] as const;

type ViewTransitionDoc = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/*
 * Text size and typeface live on <html> as data attributes (the layout's boot
 * script restores them before first paint), so that is the source of truth:
 * these hooks read it through useSyncExternalStore and notify subscribers
 * when a control changes it.
 */
const listeners = new Set<() => void>();
const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

function useStoredAttribute(key: "size" | "font", fallback: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset[key] ?? fallback,
    () => fallback
  );

  function update(next: string) {
    document.documentElement.dataset[key] = next;
    try {
      localStorage.setItem(`wv-${key}`, next);
    } catch {
      /* storage unavailable: the choice just lasts for this visit */
    }
    listeners.forEach((listener) => listener());
  }
  return [value, update] as const;
}

const noopSubscribe = () => () => {};
/* False during server render and hydration, true afterwards. */
const useIsClient = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

export default function ReaderSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();
  const [size, setSize] = useStoredAttribute("size", "m");
  const [font, setFont] = useStoredAttribute("font", "serif");

  function changeTheme(id: string, origin: HTMLElement) {
    const doc = document as ViewTransitionDoc;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce) {
      setTheme(id);
      return;
    }
    // Grow the new theme out of the button that was clicked.
    const rect = origin.getBoundingClientRect();
    document.documentElement.style.setProperty("--vt-x", `${rect.left + rect.width / 2}px`);
    document.documentElement.style.setProperty("--vt-y", `${rect.top + rect.height / 2}px`);
    doc.startViewTransition(() => {
      flushSync(() => setTheme(id));
    });
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-ink bg-card px-3.5 font-semibold shadow-[3px_3px_0_hsl(var(--stick))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
          aria-label="Reader settings: theme, text size and typeface"
        >
          <Palette className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Reader</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={12}
          collisionPadding={12}
          className="sticker z-[80] w-[min(21rem,calc(100vw-1.5rem))] p-4 outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <p className="font-hand text-xl leading-none text-muted-foreground">
            make it comfy
          </p>

          <fieldset className="mt-3">
            <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Theme
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-theme={t.id}
                  className="swatch"
                  aria-pressed={mounted && theme === t.id}
                  title={t.hint}
                  onClick={(e) => changeTheme(t.id, e.currentTarget)}
                >
                  <span className="swatch-card">
                    <span className="swatch-line w-3/4" />
                    <span className="swatch-line w-1/2" />
                    <span className="swatch-dot" />
                  </span>
                  <span className="flex items-center justify-between text-xs font-bold">
                    {t.name}
                    {mounted && theme === t.id && <Check className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="swatch justify-center"
                aria-pressed={mounted && theme === "system"}
                title="Follow your device's light/dark setting"
                onClick={(e) => changeTheme("system", e.currentTarget)}
              >
                <Monitor className="mx-auto h-5 w-5" aria-hidden="true" />
                <span className="text-center text-xs font-bold">Device</span>
              </button>
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Type className="h-3.5 w-3.5" aria-hidden="true" /> Text size
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={size === s.id}
                  aria-label={s.label}
                  onClick={() => setSize(s.id)}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-lg border-2 font-display font-bold transition-colors",
                    size === s.id
                      ? "border-ink bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-ink"
                  )}
                >
                  <span className={s.scale}>Aa</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Typeface
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={font === f.id}
                  onClick={() => setFont(f.id)}
                  className={cn(
                    "h-11 rounded-lg border-2 text-lg transition-colors",
                    f.className,
                    font === f.id
                      ? "border-ink bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-ink"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
