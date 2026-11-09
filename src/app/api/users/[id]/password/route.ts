import { hashPassword } from "@/lib/password.mjs";
import { getSessionFromRequest, hasPermission, isAllowedOrigin, jsonError, revokeUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, "users.password.reset")) return jsonError("Akses ditolak.", 403);

  const { id } = await params;
  if (id === session.userId) return jsonError("Gunakan alur perubahan password untuk akun sendiri.", 403);
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
    !("password" in body) ||
    typeof body.password !== "string" ||
    Object.keys(body).some((key) => key !== "password") ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    return jsonError("Password baru harus terdiri dari 12–128 karakter.", 400);
  }

  const passwordHash = await hashPassword(body.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await revokeUserSessions(id, tx);
  });
  return Response.json({ passwordReset: true });
}
