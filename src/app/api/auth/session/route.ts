import { getSessionFromRequest, jsonError } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return jsonError("Sesi tidak valid atau telah berakhir.", 401);

  return Response.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      isPrimarySuperuser: session.isPrimarySuperuser,
    },
    permissions: session.permissions,
  });
}
