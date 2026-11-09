import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "b2b_session";
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;

type Database = PrismaClient | Prisma.TransactionClient;

export type AuthSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  isPrimarySuperuser: boolean;
  permissions: string[];
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveSession(token: string, db: Database): Promise<AuthSession | null> {
  const session = await db.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          primarySuperuserKey: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    if (!session.revokedAt) {
      await db.userSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  const directPermissions = await db.userPermission.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { permission: { select: { code: true } } },
  });
  const permissions = new Set([
    ...session.user.role.permissions.map(({ permission }) => permission.code),
    ...directPermissions.map(({ permission }) => permission.code),
  ]);

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name || session.user.email,
    role: session.user.role.name,
    isPrimarySuperuser: session.user.primarySuperuserKey === "PRIMARY",
    permissions: [...permissions],
  };
}

export async function getSessionFromRequest(
  request: Request,
  db: Database = prisma,
): Promise<AuthSession | null> {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return resolveSession(token, db);
}

export async function getSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return resolveSession(token, prisma);
}

export async function createSession(userId: string, db: Database = prisma) {
  const token = randomBytes(32).toString("base64url");
  await db.userSession.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    },
  });
  return token;
}

export async function revokeSession(token: string, db: Database = prisma) {
  await db.userSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string, db: Database = prisma) {
  await db.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function hasPermission(session: AuthSession, permission: string) {
  return session.permissions.includes(permission);
}

export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const expectedOrigin = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : `${request.headers.get("x-forwarded-proto")?.split(",")[0] ?? url.protocol.slice(0, -1)}://${request.headers.get("x-forwarded-host")?.split(",")[0] ?? request.headers.get("host") ?? url.host}`;
  return origin === expectedOrigin;
}

export function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`,
  );
}

export function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function sessionTokenFromRequest(request: Request) {
  return request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1) ?? null;
}
