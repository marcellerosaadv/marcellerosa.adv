import { getAuth } from "@/lib/auth/server";

type Ctx = { params: Promise<{ path: string[] }> };
const h = () => getAuth().handler();

export const GET = (req: Request, ctx: Ctx) => h().GET(req, ctx);
export const POST = (req: Request, ctx: Ctx) => h().POST(req, ctx);
export const PUT = (req: Request, ctx: Ctx) => h().PUT(req, ctx);
export const DELETE = (req: Request, ctx: Ctx) => h().DELETE(req, ctx);
export const PATCH = (req: Request, ctx: Ctx) => h().PATCH(req, ctx);
