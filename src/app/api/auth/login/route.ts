import { verifyPassword } from "@/lib/password.mjs";
import {
  createSession,
  isAllowedOrigin,
  jsonError,
  setSessionCookie,
} from "@/lib/auth";
import { registerLoginAttempt, resetLoginAttempts } from "@/lib/login-throttle";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Format permintaan tidak valid.", 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return jsonError("Email dan password wajib diisi.", 400);
  }

  const email = body.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    body.password.length === 0 ||
    body.password.length > 128
  ) {
    return jsonError("Email atau password tidak valid.", 401);
  }

  if (!(await registerLoginAttempt(email))) {
    return jsonError("Terlalu banyak percobaan. Coba kembali dalam 15 menit.", 429);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, passwordHash: true },
  });
  const passwordMatches = await verifyPassword(body.password, user?.passwordHash ?? "");
  if (!user || !user.isActive || !passwordMatches) {
    return jsonError("Email atau password tidak valid.", 401);
  }

  const token = await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, passwordHash: true },
    });
    if (
      !currentUser?.isActive ||
      currentUser.passwordHash !== user.passwordHash
    ) {
      return null;
    }
    await resetLoginAttempts(email, tx);
    return createSession(user.id, tx);
  });

  if (!token) return jsonError("Email atau password tidak valid.", 401);
  const response = Response.json({ authenticated: true });
  setSessionCookie(response, token);
  return response;
}
