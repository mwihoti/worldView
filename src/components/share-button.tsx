"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

/* Uses the device's share sheet when it has one, otherwise copies the link. */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // dismissed the sheet, or sharing failed: fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy the link. You can copy it from the address bar.");
    }
  }

  return (
    <button type="button" onClick={share} className="btn-outline !px-3.5 !py-1.5 text-sm">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
