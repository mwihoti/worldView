"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Mail } from "lucide-react";
import { Input } from "./ui/input";
import { subscribeToNewsletterAction } from "@/lib/actions";

export default function NewsletterCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("newsletter")) setOpen(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  function handleSubscribe() {
    startTransition(async () => {
      const result = await subscribeToNewsletterAction(email);
      if (result.ok) {
        localStorage.setItem("newsletter", email);
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sticker gap-0 overflow-hidden border-2 border-ink p-0 sm:rounded-[var(--radius)]">
        <div className="relative border-b-2 border-ink bg-primary px-6 pb-5 pt-7 text-primary-foreground">
          <Mail
            className="wiggle absolute right-14 top-5 h-12 w-12 opacity-90"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <p className="font-hand text-2xl leading-none opacity-90">psst &mdash; before you go</p>
          <DialogHeader className="mt-1 text-left">
            <DialogTitle className="font-display text-3xl font-bold leading-tight">
              Join the newsletter
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-6">
          <p className="text-muted-foreground">
            Enter your email to join the newsletter and stay up to date with the
            latest posts published in this blog!
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <Input
              type="email"
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
              className="h-11 rounded-lg border-2 border-ink bg-background text-base"
            />
            <button
              type="button"
              className="btn-ink justify-center"
              onClick={handleSubscribe}
              disabled={isPending}
            >
              {isPending ? "Sending\u2026" : "Subscribe"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
