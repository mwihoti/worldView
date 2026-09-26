import {
  APIError,
  type Access,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type FieldAccess,
  type PayloadRequest,
  type Where,
} from "payload";

/*
 * Who may do what in the admin.
 *
 * The super-admin (SUPER_ADMIN_EMAIL) is the only account that can add,
 * delete or unlock admin users, and can update any user. It can read, edit
 * and delete every post.
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
 * To change who the super-admin is without a code change, set the
 * SUPER_ADMIN_EMAIL environment variable.
 */
export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL || "danielmwihoti@gmail.com"
)
  .trim()
  .toLowerCase();

type UserLike = { id?: number | string; email?: string | null } | null | undefined;

export function isSuperAdmin(user: UserLike): boolean {
  return Boolean(
    user?.email && user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
  );
}

/* The super-admin's user id, looked up once per request. Null if that
 * account has not been created yet. */
async function superAdminId(
  req: PayloadRequest
): Promise<number | string | null> {
  const cache = req.context as { superAdminId?: number | string | null };
  if (cache.superAdminId !== undefined) return cache.superAdminId;

  const { docs } = await req.payload.find({
    collection: "users",
    where: { email: { equals: SUPER_ADMIN_EMAIL } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });
  cache.superAdminId = docs[0]?.id ?? null;
  return cache.superAdminId;
}

/* Documents whose owner exists and is not the super-admin. `path` is the
 * owner field as seen by the collection being queried ("owner" for posts,
 * "version.owner" for the versions table). */
async function notSuperAdminOwned(
  req: PayloadRequest,
  path: string
): Promise<Where> {
  const superId = await superAdminId(req);
  const clauses: Where[] = [{ [path]: { exists: true } }];
  if (superId !== null) clauses.push({ [path]: { not_equals: superId } });
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
 * Email addresses are identities here (the super-admin is recognised by
 * email), so they are locked down: only the super-admin can change anyone's
 * email, and its own can't be changed at all, which would silently demote it.
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

  if (before === SUPER_ADMIN_EMAIL) {
    throw new APIError(
      "The super-admin's email can't be changed here. To use a different " +
        "address, set SUPER_ADMIN_EMAIL in the environment.",
      400
    );
  }
  if (!isSuperAdmin(req.user)) {
    throw new APIError("Only the super-admin can change an email address.", 403);
  }
  return data;
};
