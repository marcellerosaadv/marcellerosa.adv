import { getCrmUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCrmUser();
  return Response.json({ allowed: !!user, email: user?.email ?? null });
}
