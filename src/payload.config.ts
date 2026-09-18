import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { postgresAdapter, sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import sharp from "sharp";
import { uploadthingStorage } from "@payloadcms/storage-uploadthing";
import { Media, Posts, Users } from "./collections";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/*
 * Local dev works out of the box on SQLite (worldview.db). For production
 * (e.g. Vercel + Neon), set DATABASE_URI to a postgres:// connection string.
 */
const db = process.env.DATABASE_URI?.startsWith("postgres")
  ? postgresAdapter({
      pool: { connectionString: process.env.DATABASE_URI },
    })
  : sqliteAdapter({
      client: { url: process.env.DATABASE_URI || "file:./worldview.db" },
    });

/*
 * Vercel's serverless filesystem is read-only, so uploads can't be written to
 * staticDir. Route the media collection to UploadThing instead (free tier, no
 * card). The plugin is enabled only when UPLOADTHING_TOKEN is set, so local
 * dev keeps writing to ./media.
 */
const uploadthingToken = process.env.UPLOADTHING_TOKEN;

/*
 * Production runs on Postgres where the schema is only ever updated by hand
 * (Payload pushes schema changes automatically in dev only). The UploadThing
 * adapter added two hidden columns to "media"; until they exist every upload
 * fails with 'column "_key" does not exist'. Add them idempotently on
 * startup so a deploy is all that's needed. Safe to remove once the columns
 * are known to exist everywhere.
 */
const ensureMediaStorageColumns: NonNullable<Parameters<typeof buildConfig>[0]["onInit"]> =
  async (payload) => {
    if (payload.db.name !== "postgres") return;
    const { drizzle } = payload.db as unknown as PostgresAdapter;
    try {
      await drizzle.execute(
        sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "prefix" varchar DEFAULT ''`
      );
      await drizzle.execute(
        sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_key" varchar`
      );
    } catch (error) {
      payload.logger.error({ err: error, msg: "Could not ensure media storage columns" });
    }
  };

export default buildConfig({
  onInit: ensureMediaStorageColumns,
  secret: process.env.PAYLOAD_SECRET || "worldview-dev-secret-change-me",
  db,
  editor: lexicalEditor(),
  sharp,
  collections: [Posts, Media, Users],
  plugins: [
    uploadthingStorage({
      collections: {
        media: {
          // Serve files straight from UploadThing's CDN (public-read ACL)
          // instead of proxying them through the serverless function. The
          // proxy sent a Content-Length of 0 on Vercel, so images arrived
          // empty; the media collection is publicly readable anyway.
          disablePayloadAccessControl: true,
        },
      },
      enabled: Boolean(uploadthingToken),
      options: {
        token: uploadthingToken,
        acl: "public-read",
      },
      // Vercel serverless functions cap request bodies at 4.5MB; upload from
      // the browser straight to UploadThing so larger images work too.
      clientUploads: true,
    }),
  ],
  admin: {
    user: "users",
    // Custom admin components are referenced by paths relative to this dir.
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: " · WorldView Admin",
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
