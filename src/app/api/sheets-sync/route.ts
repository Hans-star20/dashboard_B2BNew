import { getSessionFromRequest, hasPermission, isAllowedOrigin, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTicketSync } from "@/lib/ticket-sync";

const SYNC_PERMISSION = "tickets.sync";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, SYNC_PERMISSION)) return jsonError("Akses ditolak.", 403);

  const latest = await prisma.syncLog.findFirst({
    orderBy: { startedAt: "desc" },
    select: {
      status: true,
      startedAt: true,
      finishedAt: true,
      rowsRead: true,
      inserted: true,
      updated: true,
      unchanged: true,
      skipped: true,
      failed: true,
      failureDetails: true,
      errorSummary: true,
      errorCode: true,
    },
  });
  return Response.json({ latest });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Autentikasi diperlukan.", 401);
  if (!hasPermission(session, SYNC_PERMISSION)) return jsonError("Akses ditolak.", 403);

  const result = await runTicketSync(session.userId);
  return Response.json({ result }, { status: result.status === "FAILED" ? 502 : 200 });
}
