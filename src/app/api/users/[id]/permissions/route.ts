import { getSessionFromRequest, hasPermission, isAllowedOrigin, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!session.isPrimarySuperuser || !hasPermission(session, "users.permissions.manage")) {
    return jsonError("Hanya Superuser utama yang dapat mengelola permission akun.", 403);
  }

  const { id } = await params;
  if (id === session.userId) return jsonError("Permission akun sendiri tidak dapat diubah melalui endpoint ini.", 403);
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true, primarySuperuserKey: true },
  });
  if (!target) return jsonError("Pengguna tidak ditemukan.", 404);
  if (target.primarySuperuserKey === "PRIMARY" || target.createdByUserId !== session.userId) {
    return jsonError("Anda tidak berwenang mengelola akun ini.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Format permintaan tidak valid.", 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("permissions" in body) ||
    !Array.isArray(body.permissions) ||
    body.permissions.some((permission) => typeof permission !== "string") ||
    Object.keys(body).some((key) => key !== "permissions") ||
    new Set(body.permissions).size !== body.permissions.length ||
    body.permissions.length > 100
  ) {
    return jsonError("Daftar permission tidak valid.", 400);
  }

  const permissionCodes = body.permissions as string[];
  const updated = await prisma.$transaction(async (tx) => {
    const [lockedUser] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${id} FOR UPDATE
    `;
    if (!lockedUser) throw new Error("USER_NOT_FOUND");
    const definitions = await tx.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });
    if (definitions.length !== permissionCodes.length) throw new Error("UNKNOWN_PERMISSION");

    const active = await tx.userPermission.findMany({
      where: { userId: id, revokedAt: null },
      select: { id: true, permissionId: true },
    });
    const desiredIds = new Set(definitions.map(({ id: permissionId }) => permissionId));
    const toRevoke = active.filter(({ permissionId }) => !desiredIds.has(permissionId));
    const activeIds = new Set(active.map(({ permissionId }) => permissionId));
    const toGrant = definitions.filter(({ id: permissionId }) => !activeIds.has(permissionId));
    const revokedAt = new Date();

    if (toRevoke.length) {
      await tx.userPermission.updateMany({
        where: { id: { in: toRevoke.map(({ id: grantId }) => grantId) }, revokedAt: null },
        data: { revokedAt, revokedByUserId: session.userId },
      });
    }
    if (toGrant.length) {
      await tx.userPermission.createMany({
        data: toGrant.map(({ id: permissionId }) => ({
          userId: id,
          permissionId,
          grantedByUserId: session.userId,
        })),
      });
    }
    return definitions.map(({ code }) => code);
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "UNKNOWN_PERMISSION") return null;
    throw error;
  });

  if (!updated) return jsonError("Satu atau lebih permission tidak ditemukan.", 400);
  return Response.json({ userId: id, directPermissions: updated });
}
