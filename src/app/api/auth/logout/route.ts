import {
  clearSessionCookie,
  isAllowedOrigin,
  jsonError,
  revokeSession,
  sessionTokenFromRequest,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return jsonError("Permintaan tidak diizinkan.", 403);

  const token = sessionTokenFromRequest(request);
  if (token) await revokeSession(token);
  const response = new Response(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
