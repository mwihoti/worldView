import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import sharp from "sharp";
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
 * Vercel's filesystem is read-only, so uploads to the local "media" folder
 * fail there with a 500. When a Vercel Blob store is connected to the
 * project (which sets BLOB_READ_WRITE_TOKEN), store media in Blob instead.
 * Local dev keeps writing to ./media.
 */
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "worldview-dev-secret-change-me",
  db,
  editor: lexicalEditor(),
  sharp,
  collections: [Posts, Media, Users],
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(blobToken),
      token: blobToken,
      collections: { media: true },
      // Vercel serverless functions cap request bodies at 4.5MB; upload from
      // the browser straight to Blob so larger images work too.
      clientUploads: true,
    }),
  ],
  admin: {
    user: "users",
    meta: {
      titleSuffix: " · WorldView Admin",
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
