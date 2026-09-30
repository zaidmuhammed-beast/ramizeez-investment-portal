import { joinSession } from "@/lib/tank/service";
import { redirectOut } from "@/lib/tank/redirect";

/** Personal, audited join link for a live Tank session. */
export async function GET(req: Request, ctx: RouteContext<"/api/tank/[id]/join">) {
  const { id } = await ctx.params;
  return redirectOut(req, `/sessions/${id}`, (user) => joinSession(user, id));
}
