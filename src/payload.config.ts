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
 * (Payload pushes schema changes automatically in dev only), so columns added
 * to the config after the first deploy don't exist there and every query that
 * touches them fails. Add them idempotently on startup so a deploy is all
 * that's needed:
 *  - media.prefix / media._key, added by the UploadThing adapter
 *  - posts.owner_id / _posts_v.version_owner_id, the admin that owns a post
 *    (definitions copied from what Payload generates in dev)
 * Safe to remove once these columns are known to exist everywhere.
 */
const SCHEMA_REPAIRS = [
  `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "prefix" varchar DEFAULT ''`,
  `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_key" varchar`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "owner_id" integer`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_owner_id" integer`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_owner_id_users_id_fk') THEN
       ALTER TABLE "posts" ADD CONSTRAINT "posts_owner_id_users_id_fk"
         FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_version_owner_id_users_id_fk') THEN
       ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_owner_id_users_id_fk"
         FOREIGN KEY ("version_owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
     END IF;
   END $$`,
  `CREATE INDEX IF NOT EXISTS "posts_owner_idx" ON "posts" ("owner_id")`,
  `CREATE INDEX IF NOT EXISTS "_posts_v_version_version_owner_idx" ON "_posts_v" ("version_owner_id")`,
];

const ensureSchemaColumns: NonNullable<Parameters<typeof buildConfig>[0]["onInit"]> =
  async (payload) => {
    if (payload.db.name !== "postgres") return;
    const { drizzle } = payload.db as unknown as PostgresAdapter;
    // One statement at a time so a failure in one doesn't skip the rest.
    for (const statement of SCHEMA_REPAIRS) {
      try {
        await drizzle.execute(sql.raw(statement));
      } catch (error) {
        payload.logger.error({
          err: error,
          msg: `Schema repair failed: ${statement.replace(/\s+/g, " ").slice(0, 90)}`,
        });
      }
    }
  };

export default buildConfig({
  onInit: ensureSchemaColumns,
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
