import type { CollectionConfig } from "payload";
import { APIError } from "payload";
import { aiReviewFields, applyReviewToken, draftWithAI } from "./lib/ai-review";
import { revalidateSite } from "./lib/revalidate";
import { CATEGORIES, SECTION_ORDER } from "./lib/category";
import { aiAssistantHandler, aiDraftHandler } from "./lib/ai-assistant";
import {
  guardEmailChanges,
  guardRoles,
  ownerFieldAccess,
  preventDeletingLastSuperAdmin,
  roleFieldAccess,
  postAccess,
  setPostOwner,
  syncOwnerToLiveDoc,
  userAccess,
} from "./lib/access";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  // Email is what the post "Owner" column shows, so use it as the title.
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role"] },
  access: userAccess,
  hooks: {
    beforeChange: [guardEmailChanges, guardRoles],
    beforeDelete: [preventDeletingLastSuperAdmin],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "role",
      type: "select",
      defaultValue: "admin",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Super-admin", value: "super-admin" },
      ],
      // Only a super-admin can set or change it; anyone else's value is
      // dropped before it reaches the database.
      access: roleFieldAccess,
      admin: {
        position: "sidebar",
        description:
          "Super-admins manage users and roles and can edit every post. Admins " +
          "write and edit their own posts.",
      },
    },
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
    afterChange: [
      ({ doc }) => {
        revalidateSite();
        return doc;
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
    defaultColumns: ["title", "owner", "author", "_status", "publishedAt"],
    description:
      "Articles published here appear on the site right away. " +
      "Fill in “AI prompt” and click “Generate draft” to have the AI write a first draft, " +
      "then use the AI assistant below the content to request corrections before publishing.",
  },
  versions: { drafts: true },
  access: postAccess,
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      hooks: {
        // Pasted titles often carry a trailing space.
        beforeValidate: [({ value }) => (typeof value === "string" ? value.trim() : value)],
      },
    },
    {
      name: "subtitle",
      label: "Summary",
      type: "textarea",
      maxLength: 300,
      admin: {
        rows: 2,
        description:
          "One sentence shown under the headline and on story cards. “Generate draft” suggests one.",
      },
    },
    {
      name: "slug",
      type: "text",
      unique: true,
      admin: {
        position: "sidebar",
        description: "URL path of the article. Generated from the title if left empty.",
      },
      hooks: {
        // Always clean the slug, including one typed or pasted by hand: a
        // slug like "UbuTangaza " (capitals, trailing space) produced a link
        // browsers could not follow, so the post 404ed.
        beforeValidate: [
          ({ value, data, originalDoc }) => {
            // Leave a saved slug alone unless it is being edited, so an older
            // odd slug doesn't block unrelated saves (e.g. reassigning the owner).
            if (typeof value === "string" && value && originalDoc?.slug === value) return value;
            const raw = typeof value === "string" && value.trim() ? value : data?.title;
            return typeof raw === "string" ? slugify(raw) : value;
          },
        ],
      },
    },
    {
      name: "section",
      type: "select",
      options: SECTION_ORDER.map((id) => ({ label: CATEGORIES[id].label, value: CATEGORIES[id].slug })),
      admin: {
        position: "sidebar",
        description:
          "Where the story is filed on the site. Left empty, it is guessed from the author and title. " +
          "“Generate draft” suggests one.",
      },
    },
    {
      name: "metaDescription",
      label: "Search description",
      type: "textarea",
      maxLength: 200,
      admin: {
        position: "sidebar",
        rows: 3,
        description:
          "Shown by search engines and link previews (about 155 characters). Falls back to the summary.",
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
          "Describe the article you want (topic, angle, length, tone), then click “Generate draft”. Links to pages are read and used as sources.",
      },
    },
    {
      // For REST/API callers: set to true on save to have the server write
      // the draft. The admin uses the streaming "Generate draft" button below
      // instead, which shows progress.
      name: "draftWithAI",
      label: "Draft with AI on save",
      type: "checkbox",
      defaultValue: false,
      admin: { hidden: true },
    },
    {
      name: "aiDraft",
      type: "ui",
      admin: {
        components: {
          Field: "/components/admin/AIDraftButton#AIDraftButton",
        },
      },
    },
    { name: "content", type: "richText" },
    ...aiReviewFields,
    {
      name: "owner",
      label: "Owner (admin)",
      type: "relationship",
      relationTo: "users",
      // Read-only for everyone but the super-admin, who can hand a post over.
      access: ownerFieldAccess,
      admin: {
        position: "sidebar",
        description:
          "The admin who created this post; set automatically. Only the super-admin " +
          "can change it. Posts with no owner (made before this was tracked) count as " +
          "the super-admin's and are hidden from other admins until assigned.",
      },
    },
    {
      name: "aiAssistant",
      type: "ui",
      admin: {
        components: {
          Field: "/components/admin/AIAssistant#AIAssistant",
        },
      },
    },
  ],
  // Streaming AI endpoints used by the admin panels above (see ai-assistant.ts).
  endpoints: [
    { path: "/ai-draft", method: "post", handler: aiDraftHandler },
    { path: "/ai-chat", method: "post", handler: aiAssistantHandler },
  ],
  hooks: {
    beforeChange: [setPostOwner, applyReviewToken, draftWithAI],
    // Make the change visible on the site right away instead of after the
    // 5-minute static cache expires.
    afterChange: [
      syncOwnerToLiveDoc,
      ({ doc, previousDoc }) => {
        revalidateSite([doc?.slug, previousDoc?.slug]);
        return doc;
      },
    ],
    afterDelete: [
      ({ doc }) => {
        revalidateSite([doc?.slug]);
        return doc;
      },
    ],
  },
};
