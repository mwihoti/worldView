import { describe, expect, it } from "vitest";
import {
  assertCanEditPost,
  guardRoles,
  isSuperAdmin,
  postAccess,
  roleFieldAccess,
  setPostOwner,
} from "@/lib/access";

const SUPER = { id: 1, role: "super-admin" };
const ADMIN = { id: 2, role: "admin" };

/* A request whose payload answers find/count/findByID from simple stubs. */
function fakeReq(user: unknown, opts: { superIds?: number[]; users?: number; superCount?: number; post?: unknown } = {}) {
  return {
    user,
    context: {},
    payload: {
      find: async () => ({ docs: (opts.superIds ?? [1]).map((id) => ({ id })) }),
      count: async ({ where }: { where?: unknown }) => ({
        totalDocs: where ? (opts.superCount ?? 1) : (opts.users ?? 1),
      }),
      findByID: async () => {
        if (opts.post === undefined) throw new Error("not found");
        return opts.post;
      },
    },
  } as never;
}

describe("roles", () => {
  it("only the role makes a super-admin", () => {
    expect(isSuperAdmin(SUPER)).toBe(true);
    expect(isSuperAdmin(ADMIN)).toBe(false);
    expect(isSuperAdmin({ id: 3, email: "danielmwihoti@gmail.com" } as never)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("only super-admins may set roles", () => {
    expect(roleFieldAccess.update({ req: fakeReq(SUPER) } as never)).toBe(true);
    expect(roleFieldAccess.update({ req: fakeReq(ADMIN) } as never)).toBe(false);
    expect(roleFieldAccess.create({ req: fakeReq(null) } as never)).toBe(false);
  });

  it("the first account becomes super-admin, later ones admin", async () => {
    const first = await guardRoles({ data: {}, operation: "create", req: fakeReq(null, { users: 0 }) } as never);
    expect(first.role).toBe("super-admin");
    const later = await guardRoles({ data: {}, operation: "create", req: fakeReq(SUPER, { users: 3 }) } as never);
    expect(later.role).toBe("admin");
  });

  it("the last super-admin can't be demoted", async () => {
    await expect(
      guardRoles({
        data: { role: "admin" },
        originalDoc: SUPER,
        operation: "update",
        req: fakeReq(SUPER, { superCount: 1 }),
      } as never)
    ).rejects.toThrow(/only super-admin/);
    const ok = await guardRoles({
      data: { role: "admin" },
      originalDoc: SUPER,
      operation: "update",
      req: fakeReq(SUPER, { superCount: 2 }),
    } as never);
    expect(ok.role).toBe("admin");
  });
});

describe("post access", () => {
  it("visitors only see published posts", async () => {
    expect(await postAccess.read!({ req: fakeReq(null) } as never)).toEqual({ _status: { equals: "published" } });
  });

  it("super-admins see everything", async () => {
    expect(await postAccess.read!({ req: fakeReq(SUPER) } as never)).toBe(true);
  });

  it("admins never see super-admin-owned or ownerless posts", async () => {
    expect(await postAccess.read!({ req: fakeReq(ADMIN, { superIds: [1, 5] }) } as never)).toEqual({
      and: [{ owner: { exists: true } }, { owner: { not_in: [1, 5] } }],
    });
  });

  it("admins may only edit their own posts", () => {
    expect(postAccess.update!({ req: fakeReq(ADMIN) } as never)).toEqual({ owner: { equals: 2 } });
    expect(postAccess.update!({ req: fakeReq(SUPER) } as never)).toBe(true);
    expect(postAccess.update!({ req: fakeReq(null) } as never)).toBe(false);
  });

  it("owner is set from the creator and can't be changed by admins", () => {
    const created = setPostOwner({ data: { owner: 99 }, operation: "create", req: fakeReq(ADMIN) } as never);
    expect(created.owner).toBe(2);
    const updated = setPostOwner({
      data: { owner: 99 },
      originalDoc: { owner: 2 },
      operation: "update",
      req: fakeReq(ADMIN),
    } as never);
    expect(updated.owner).toBe(2);
    const handedOver = setPostOwner({
      data: { owner: 7 },
      originalDoc: { owner: 2 },
      operation: "update",
      req: fakeReq(SUPER),
    } as never);
    expect(handedOver.owner).toBe(7);
  });
});

describe("assertCanEditPost (AI endpoints)", () => {
  it("requires a login", async () => {
    await expect(assertCanEditPost(fakeReq(null), 1)).rejects.toMatchObject({ status: 401 });
  });
  it("allows an unsaved post", async () => {
    await expect(assertCanEditPost(fakeReq(ADMIN), null)).resolves.toBeUndefined();
  });
  it("allows the owner and super-admins, refuses others", async () => {
    await expect(assertCanEditPost(fakeReq(ADMIN, { post: { owner: 2 } }), 9)).resolves.toBeUndefined();
    await expect(assertCanEditPost(fakeReq(ADMIN, { post: { owner: { id: 2 } } }), 9)).resolves.toBeUndefined();
    await expect(assertCanEditPost(fakeReq(SUPER, { post: { owner: 2 } }), 9)).resolves.toBeUndefined();
    await expect(assertCanEditPost(fakeReq(ADMIN, { post: { owner: 1 } }), 9)).rejects.toMatchObject({ status: 403 });
    await expect(assertCanEditPost(fakeReq(ADMIN, { post: { owner: null } }), 9)).rejects.toMatchObject({ status: 403 });
  });
  it("404s a missing post", async () => {
    await expect(assertCanEditPost(fakeReq(ADMIN), 9)).rejects.toMatchObject({ status: 404 });
  });
});
