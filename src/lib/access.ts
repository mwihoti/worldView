import {
  APIError,
  type Access,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type FieldAccess,
  type Payload,
  type PayloadRequest,
  type Where,
} from "payload";

/*
 * Who may do what in the admin.
 *
 * A super-admin (a user whose "role" is super-admin) is the only kind of
 * account that can add, delete or unlock admin users, change anyone's role,
 * and update any user. It can read, edit and delete every post.
 *
 * Every other admin can create posts, edit and delete only their own, and
 * read other admins' posts so they can see who is working on what (each post
 * shows its owner's email). They never see the super-admin's posts, nor posts
 * with no owner: those predate ownership tracking and count as the
 * super-admin's.
 *
 * Visitors only ever get published posts through the REST API. (The public
 * site itself reads through Payload's Local API, which bypasses access
 * control, so none of this affects what the site renders.)
 *
 * The role is stored on the user and only a super-admin can change it (see
 * roleFieldAccess). The very first account created on a fresh database
 * becomes super-admin; on an existing database with none, ensureSuperAdmin
 * promotes one at startup.
 */
export const SUPER_ADMIN = "super-admin";

type UserLike = { id?: number | string; role?: string | null } | null | undefined;

export function isSuperAdmin(user: UserLike): boolean {
  return user?.role === SUPER_ADMIN;
}

/* Every super-admin's user id, looked up once per request. */
async function superAdminIds(req: PayloadRequest): Promise<(number | string)[]> {
  const cache = req.context as { superAdminIds?: (number | string)[] };
  if (cache.superAdminIds !== undefined) return cache.superAdminIds;

  const { docs } = await req.payload.find({
    collection: "users",
    where: { role: { equals: SUPER_ADMIN } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });
  cache.superAdminIds = docs.map((doc) => doc.id);
  return cache.superAdminIds;
}

/* Documents whose owner exists and is not the super-admin. `path` is the
 * owner field as seen by the collection being queried ("owner" for posts,
 * "version.owner" for the versions table). */
async function notSuperAdminOwned(
  req: PayloadRequest,
  path: string
): Promise<Where> {
  const superIds = await superAdminIds(req);
  const clauses: Where[] = [{ [path]: { exists: true } }];
  if (superIds.length > 0) clauses.push({ [path]: { not_in: superIds } });
  return { and: clauses };
}

const ownPostsOnly: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return { owner: { equals: user.id } };
};

export const postAccess: NonNullable<CollectionConfig["access"]> = {
  read: async ({ req }) => {
    if (!req.user) return { _status: { equals: "published" } };
    if (isSuperAdmin(req.user)) return true;
    return notSuperAdminOwned(req, "owner");
  },
  update: ownPostsOnly,
  delete: ownPostsOnly,
  readVersions: async ({ req }) => {
    if (!req.user) return false;
    if (isSuperAdmin(req.user)) return true;
    return notSuperAdminOwned(req, "version.owner");
  },
};

export const userAccess: NonNullable<CollectionConfig["access"]> = {
  create: ({ req }) => isSuperAdmin(req.user),
  delete: ({ req }) => isSuperAdmin(req.user),
  unlock: ({ req }) => isSuperAdmin(req.user),
  read: ({ req }) => Boolean(req.user),
  update: ({ req: { user } }) => {
    if (!user) return false;
    if (isSuperAdmin(user)) return true;
    return { id: { equals: user.id } };
  },
};

/*
 * Records who created a post. Set from the logged-in user on creation
 * (anything a client sends for it is ignored). Afterwards only the
 * super-admin can change it, to hand over a post: posts made before
 * ownership was tracked have no owner, so a regular admin who wrote one
 * loses sight of it until the super-admin assigns it to them. Everyone
 * else's attempt to change it is ignored.
 */
const ownerId = (owner: unknown) =>
  owner && typeof owner === "object" ? (owner as { id?: number | string }).id : owner;

export const setPostOwner: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === "create") {
    if (req.user) data.owner = req.user.id;
  } else if (isSuperAdmin(req.user) && data.owner !== undefined) {
    data.owner = ownerId(data.owner) ?? null;
  } else {
    data.owner = ownerId(originalDoc?.owner) ?? null;
  }
  return data;
};

/*
 * A "Save draft" on an already-published post only writes a draft version and
 * leaves the live post untouched, but ownership decides who can see and edit
 * the post at all, so an owner change made that way must reach the live post
 * too. Otherwise the super-admin would hand a post over, see the new owner in
 * the form, and the new owner still couldn't find it. Direct database update:
 * no hooks and no new version.
 */
export const syncOwnerToLiveDoc: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!isSuperAdmin(req.user)) return doc;
  const next = ownerId(doc?.owner) ?? null;
  if (next === (ownerId(previousDoc?.owner) ?? null)) return doc;
  await req.payload.db.updateOne({
    collection: "posts",
    id: doc.id,
    data: { owner: next },
    req,
    returning: false,
  });
  return doc;
};

export const ownerFieldAccess: { update: FieldAccess } = {
  update: ({ req }) => isSuperAdmin(req.user),
};

/*
 * Email addresses are logins and what the post "Owner" column shows, so
 * only a super-admin can change one.
 */
export const guardEmailChanges: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== "update" || !originalDoc || data?.email === undefined) {
    return data;
  }
  const before = String(originalDoc.email ?? "").trim().toLowerCase();
  const after = String(data.email ?? "").trim().toLowerCase();
  if (before === after) return data;

  if (!isSuperAdmin(req.user)) {
    throw new APIError("Only a super-admin can change an email address.", 403);
  }
  return data;
};

/* Only a super-admin can grant or change roles. */
export const roleFieldAccess: { create: FieldAccess; update: FieldAccess } = {
  create: ({ req }) => isSuperAdmin(req.user),
  update: ({ req }) => isSuperAdmin(req.user),
};

async function countSuperAdmins(req: PayloadRequest): Promise<number> {
  const { totalDocs } = await req.payload.count({
    collection: "users",
    where: { role: { equals: SUPER_ADMIN } },
    overrideAccess: true,
    req,
  });
  return totalDocs;
}

/*
 * Users beforeChange: the first account on a fresh database is the
 * super-admin (whoever sets up the site), everyone after defaults to admin.
 * The last super-admin can't be demoted, or nobody could manage users.
 */
export const guardRoles: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === "create") {
    const { totalDocs } = await req.payload.count({
      collection: "users",
      overrideAccess: true,
      req,
    });
    if (totalDocs === 0) data.role = SUPER_ADMIN;
    else if (!data.role) data.role = "admin";
    return data;
  }
  if (
    originalDoc?.role === SUPER_ADMIN &&
    data.role !== undefined &&
    data.role !== SUPER_ADMIN &&
    (await countSuperAdmins(req)) <= 1
  ) {
    throw new APIError(
      "This is the only super-admin. Make someone else a super-admin first.",
      400
    );
  }
  return data;
};

export const preventDeletingLastSuperAdmin: CollectionBeforeDeleteHook = async ({
  id,
  req,
}) => {
  const user = await req.payload.findByID({
    collection: "users",
    id,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (isSuperAdmin(user) && (await countSuperAdmins(req)) <= 1) {
    throw new APIError(
      "This is the only super-admin. Make someone else a super-admin first.",
      400
    );
  }
};

/*
 * Startup: databases from before roles existed have no super-admin. Promote
 * the account named by SUPER_ADMIN_EMAIL if it exists, otherwise the oldest
 * account (whoever set the site up). Does nothing once any super-admin
 * exists, so it can't be used to take over a running site.
 */
export async function ensureSuperAdmin(payload: Payload): Promise<void> {
  const existing = await payload.count({
    collection: "users",
    where: { role: { equals: SUPER_ADMIN } },
    overrideAccess: true,
  });
  if (existing.totalDocs > 0) return;

  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const byEmail = email
    ? await payload.find({
        collection: "users",
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    : null;
  const oldest = byEmail?.docs[0]
    ? null
    : await payload.find({
        collection: "users",
        sort: "createdAt",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
  const target = byEmail?.docs[0] ?? oldest?.docs[0];
  if (!target) return;

  await payload.update({
    collection: "users",
    id: target.id,
    data: { role: SUPER_ADMIN },
    overrideAccess: true,
    context: { bootstrappingSuperAdmin: true },
  });
  payload.logger.info(`No super-admin existed; promoted ${target.email} to super-admin.`);
}

/*
 * The AI endpoints act on a post the editor has open. When it already
 * exists, they may only be used by someone allowed to edit it — the same
 * rule as `update` above — so an admin can't use the assistant to read or
 * rewrite another admin's post. A post that hasn't been saved yet (no id)
 * belongs to whoever is creating it.
 */
export async function assertCanEditPost(
  req: PayloadRequest,
  postId: string | number | null | undefined
): Promise<void> {
  if (!req.user) {
    throw new APIError("You must be logged in to use the AI assistant.", 401);
  }
  if (postId === null || postId === undefined || postId === "") return;

  let doc: { owner?: unknown } | null = null;
  try {
    doc = await req.payload.findByID({
      collection: "posts",
      id: postId,
      depth: 0,
      draft: true,
      overrideAccess: true,
      req,
    });
  } catch {
    doc = null;
  }
  if (!doc) throw new APIError("That post doesn't exist.", 404);
  if (isSuperAdmin(req.user)) return;
  if ((ownerId(doc.owner) ?? null) !== req.user.id) {
    throw new APIError("You can only use the AI assistant on your own posts.", 403);
  }
}
