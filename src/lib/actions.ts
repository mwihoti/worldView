"use server";

import { headers } from "next/headers";
import { ClientError } from "graphql-request";
import { z } from "zod";
import { getPosts, newsletterAvailable, subscribeToNewsletter } from "./requests";
import { PostsPage } from "./types";

export async function loadMorePosts(after: string): Promise<PostsPage> {
  return getPosts({ first: 12, after });
}

const emailSchema = z.email().max(254);

/* A few sign-up attempts per visitor per 10 minutes is plenty; this only
 * stops a script hammering the form (per server instance, in memory). */
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const SIGNUPS_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < SIGNUP_WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 10_000) attempts.clear();
  return recent.length > SIGNUPS_PER_WINDOW;
}

export async function subscribeToNewsletterAction(
  rawEmail: string
): Promise<{ ok: boolean; message: string }> {
  if (!newsletterAvailable) {
    return { ok: false, message: "Newsletter sign-up isn't available right now." };
  }
  const parsed = emailSchema.safeParse(String(rawEmail ?? "").trim());
  if (!parsed.success) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  const email = parsed.data;

  const requestHeaders = await headers();
  const visitor =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (tooManyAttempts(visitor)) {
    return { ok: false, message: "Too many attempts. Please try again in a few minutes." };
  }

  try {
    await subscribeToNewsletter(email);
    return {
      ok: true,
      message:
        "Subscribed to newsletter! Check your email to confirm your subscription.",
    };
  } catch (error) {
    if (error instanceof ClientError && error.response.errors?.length) {
      return { ok: false, message: error.response.errors[0].message };
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Newsletter sign-up failed: ${message.slice(0, 200)}`);
    return {
      ok: false,
      message: "Sign-up failed on our side. Please try again later.",
    };
  }
}
