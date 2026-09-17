import type { CollectionConfig } from "payload";
import { APIError } from "payload";
import { draftWithAI } from "./lib/ai";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
  ],
};

/*
 * On Vercel the filesystem is read-only, so uploads only work through the
 * UploadThing adapter (see payload.config.ts). Without its token Payload
 * falls back to local disk and the save dies with an opaque
 * "Something went wrong" (ENOENT mkdir 'media' in the logs). Fail early
 * with a message that says what to fix instead.
 */
const storageConfigured = Boolean(process.env.UPLOADTHING_TOKEN);
const uploadsUnavailableOnVercel = Boolean(process.env.VERCEL) && !storageConfigured;

export const Media: CollectionConfig = {
  slug: "media",
  access: { read: () => true },
  upload: {
    staticDir: "media",
    mimeTypes: ["image/*"],
  },
  hooks: {
    beforeChange: [
      /*
       * With clientUploads the browser sends the file straight to UploadThing
       * and only its key reaches the server (req.file.clientUploadContext).
       * The storage plugin skips handleUpload for such files, so nothing
       * writes that key to the document and the file can never be served
       * (docs ended up with _key null and /api/media/file/... 404). Record
       * it here.
       */
      ({ data, req }) => {
        const ctx = req.file?.clientUploadContext;
        if (ctx && typeof ctx === "object" && "key" in ctx && typeof ctx.key === "string") {
          data._key = ctx.key;
        }
        return data;
      },
    ],
    beforeOperation: [
      ({ operation }) => {
        if (uploadsUnavailableOnVercel && (operation === "create" || operation === "update")) {
          throw new APIError(
            "Media uploads are not configured: UPLOADTHING_TOKEN is missing. " +
              "Add it to the Vercel project's environment variables (Production " +
              "and Preview), then redeploy.",
            503,
          );
        }
      },
    ],
  },
  fields: [
    { name: "alt", type: "text" },
    /*
     * When the UploadThing adapter is active it adds hidden "prefix" and
     * "_key" fields. Define the same fields when it is disabled (local dev)
     * so the schema is identical everywhere; otherwise pushing the schema
     * from a local dev server leaves production without these columns and
     * uploads fail with 'column "_key" does not exist'.
     */
    ...(storageConfigured
      ? []
      : ([
          {
            name: "prefix",
            type: "text",
            defaultValue: "",
            admin: { hidden: true, readOnly: true },
          },
          {
            name: "_key",
            type: "text",
            admin: {
              hidden: true,
              disableBulkEdit: true,
              disableListColumn: true,
              disableListFilter: true,
            },
          },
        ] satisfies CollectionConfig["fields"])),
  ],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "author", "_status", "publishedAt"],
    description:
      "Articles published here appear on the site within a few minutes. " +
      "Fill in “AI prompt” and tick “Draft with AI” to have the AI write a first draft on save.",
  },
  versions: { drafts: true },
  access: { read: () => true },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      unique: true,
      admin: {
        position: "sidebar",
        description: "URL path of the article. Generated from the title if left empty.",
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => value || (data?.title ? slugify(data.title) : value),
        ],
      },
    },
    {
      name: "author",
      type: "text",
      required: true,
      defaultValue: "WorldView",
      admin: { position: "sidebar" },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: { position: "sidebar" },
      hooks: {
        beforeChange: [
          ({ value, data }) =>
            value ?? (data?._status === "published" ? new Date().toISOString() : value),
        ],
      },
    },
    {
      name: "cover",
      type: "upload",
      relationTo: "media",
      admin: { position: "sidebar" },
    },
    {
      name: "aiPrompt",
      label: "AI prompt",
      type: "textarea",
      admin: {
        description:
          "Describe the article you want (topic, angle, length, tone). Used only when “Draft with AI” is ticked.",
      },
    },
    {
      name: "draftWithAI",
      label: "Draft with AI on save",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "When ticked, saving generates the article content from the AI prompt (replaces the current content).",
      },
    },
    { name: "content", type: "richText" },
  ],
  hooks: {
    beforeChange: [draftWithAI],
  },
};
