import { hashPassword } from "@/lib/password.mjs";
import {
  getSessionFromRequest,
  hasPermission,
  isAllowedOrigin,
  jsonError,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const userSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  role: { select: { name: true } },
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, "users.read")) return jsonError("Akses ditolak.", 403);

  const users = await prisma.user.findMany({
    where: { createdByUserId: session.userId },
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ users });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, "users.create")) return jsonError("Akses ditolak.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Format permintaan tidak valid.", 400);
  }
  if (
    !isObject(body) ||
    Object.keys(body).some((key) => !["email", "name", "password", "role"].includes(key)) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.role !== "string" ||
    (body.name !== undefined && body.name !== null && typeof body.name !== "string")
  ) {
    return jsonError("Data pengguna tidak valid.", 400);
  }

  const email = body.email.trim().toLowerCase();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    (name !== null && (name.length === 0 || name.length > 191)) ||
    body.password.length < 12 ||
    body.password.length > 128 ||
    !["HELPDESK", "SUPERVISOR"].includes(body.role)
  ) {
    return jsonError("Email, nama, password, atau role tidak memenuhi ketentuan.", 400);
  }
  if (!session.isPrimarySuperuser && body.role !== session.role) {
    return jsonError("Anda hanya dapat membuat akun dengan role yang sama.", 403);
  }

  const passwordHash = await hashPassword(body.password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: body.role as string } });
      if (!role) throw new Error("ROLE_NOT_CONFIGURED");
      return tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          roleId: role.id,
          createdByUserId: session.userId,
        },
        select: userSelect,
      });
    });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_CONFIGURED") {
      return jsonError("Role tujuan belum tersedia.", 409);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError("Email telah digunakan.", 409);
    }
    console.error("Create user failed", error);
    return jsonError("Pengguna tidak dapat dibuat.", 500);
  }
}
