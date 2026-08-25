"use server";

import { ClientError } from "graphql-request";
import { getPosts, subscribeToNewsletter } from "./requests";
import { PostsPage } from "./types";

export async function loadMorePosts(after: string): Promise<PostsPage> {
  return getPosts({ first: 12, after });
}

export async function subscribeToNewsletterAction(
  email: string
): Promise<{ ok: boolean; message: string }> {
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Please enter a valid email address." };
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
    return { ok: false, message: "Something went wrong!" };
  }
}
