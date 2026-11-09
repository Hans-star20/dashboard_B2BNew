import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function getAttemptKey(email: string) {
  const secret = process.env.AUTH_THROTTLE_SECRET ?? process.env.DATABASE_URL;
  if (!secret) throw new Error("AUTH_THROTTLE_SECRET or DATABASE_URL must be configured.");
  return createHmac("sha256", secret).update(email).digest("hex");
}

export async function registerLoginAttempt(email: string, db: PrismaClient = prisma) {
  const attemptKey = getAttemptKey(email);
  return db.$transaction(async (tx) => {
    await tx.loginThrottle.upsert({
      where: { attemptKey },
      create: { attemptKey, attempts: 0 },
      update: {},
    });
    const [row] = await tx.$queryRaw<
      { attempts: number | bigint; windowStartedAt: Date; lockedUntil: Date | null }[]
    >`SELECT attempts, windowStartedAt, lockedUntil FROM login_throttles WHERE attemptKey = ${attemptKey} FOR UPDATE`;
    const now = new Date();
    if (row.lockedUntil && row.lockedUntil > now) return false;

    const resetWindow = row.windowStartedAt.getTime() <= now.getTime() - WINDOW_MILLISECONDS;
    const attempts = resetWindow ? 1 : Number(row.attempts) + 1;
    const lockedUntil =
      attempts > MAX_ATTEMPTS ? new Date(now.getTime() + WINDOW_MILLISECONDS) : null;
    await tx.loginThrottle.update({
      where: { attemptKey },
      data: {
        attempts,
        windowStartedAt: resetWindow ? now : row.windowStartedAt,
        lockedUntil,
      },
    });
    return attempts <= MAX_ATTEMPTS;
  });
}

export async function resetLoginAttempts(
  email: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
) {
  const attemptKey = getAttemptKey(email);
  await db.loginThrottle.updateMany({
    where: { attemptKey },
    data: { attempts: 0, windowStartedAt: new Date(), lockedUntil: null },
  });
}
