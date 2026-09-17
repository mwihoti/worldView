/* Payload REST API — scaffold per @payloadcms/next */
import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

/*
 * "Draft with AI" runs an LLM request (plus fetching any pages the brief
 * links to) inside the posts PATCH/POST handler. Vercel's default function
 * limit is 10s, which made those saves fail with a 504; 60s is the maximum
 * allowed on the Hobby plan without Fluid compute.
 */
export const maxDuration = 60;

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
