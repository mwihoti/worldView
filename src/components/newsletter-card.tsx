"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Join the newsletter!
          </DialogTitle>
        </DialogHeader>
        <p>
          Enter your email to join the newsletter and stay up to date with the
          latest posts published in this blog!
        </p>
        <div className="flex flex-col gap-5 mt-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={handleSubscribe} disabled={isPending}>
            {isPending ? "Loading..." : "Subscribe"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
