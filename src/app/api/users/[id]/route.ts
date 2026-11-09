import { getSessionFromRequest, hasPermission, isAllowedOrigin, jsonError, revokeUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, "users.update")) return jsonError("Akses ditolak.", 403);

  const { id } = await params;
  if (id === session.userId) return jsonError("Akun sendiri tidak dapat dikelola melalui endpoint ini.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Format permintaan tidak valid.", 400);
  }
  if (
    !isObject(body) ||
    Object.keys(body).length === 0 ||
    Object.keys(body).some((key) => !["name", "isActive", "role"].includes(key)) ||
    (body.name !== undefined && body.name !== null && typeof body.name !== "string") ||
    (body.isActive !== undefined && typeof body.isActive !== "boolean") ||
    (body.role !== undefined && typeof body.role !== "string")
  ) {
    return jsonError("Perubahan pengguna tidak valid.", 400);
  }
  if (body.role !== undefined && !session.isPrimarySuperuser) {
    return jsonError("Hanya Superuser utama yang dapat mengubah role.", 403);
  }
  if (body.role !== undefined && !["HELPDESK", "SUPERVISOR"].includes(body.role as string)) {
    return jsonError("Role Superuser tidak dapat diberikan melalui pengelolaan pengguna.", 403);
  }
  if (typeof body.name === "string" && (body.name.trim().length === 0 || body.name.trim().length > 191)) {
    return jsonError("Nama tidak valid.", 400);
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true, primarySuperuserKey: true, role: { select: { name: true } } },
  });
  if (!target) return jsonError("Pengguna tidak ditemukan.", 404);
  if (target.primarySuperuserKey === "PRIMARY" || target.createdByUserId !== session.userId) {
    return jsonError("Anda tidak berwenang mengelola akun ini.", 403);
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      let roleId: string | undefined;
      if (body.role !== undefined) {
        const role = await tx.role.findUnique({ where: { name: body.role as string } });
        if (!role) throw new Error("ROLE_NOT_CONFIGURED");
        roleId = role.id;
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name === null ? null : (body.name as string).trim() } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
          ...(roleId ? { roleId } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          role: { select: { name: true } },
        },
      });
      if (body.isActive === false || roleId) await revokeUserSessions(id, tx);
      return updated;
    });
    return Response.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_CONFIGURED") {
      return jsonError("Role tujuan belum tersedia.", 409);
    }
    console.error("Update user failed", error);
    return jsonError("Pengguna tidak dapat diperbarui.", 500);
  }
}
