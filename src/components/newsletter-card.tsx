"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { subscribeToNewsletterAction } from "@/lib/actions";

/* Newsletter sign-up, opened by the masthead's Subscribe button. */
export default function NewsletterCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("wv:subscribe", show);
    return () => window.removeEventListener("wv:subscribe", show);
  }, []);

  function handleSubscribe() {
    startTransition(async () => {
      const result = await subscribeToNewsletterAction(email);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setEmail("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden rounded-[var(--radius)] border border-border p-0 sm:max-w-md">
        <div className="masthead px-7 pb-6 pt-7">
          <p className="kicker !text-masthead-accent">Newsletter</p>
          <DialogHeader className="mt-2 text-left">
            <DialogTitle className="headline text-3xl text-masthead-foreground">The WorldView briefing</DialogTitle>
            <DialogDescription className="mt-2 text-[0.95rem] text-masthead-foreground/80">
              The best new stories, straight to your inbox. No spam, unsubscribe any time.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form
          className="flex flex-col gap-3 p-7"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubscribe();
          }}
        >
          <label htmlFor="newsletter-email" className="text-sm font-medium">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="submit" className="btn mt-1" disabled={isPending}>
            {isPending ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
