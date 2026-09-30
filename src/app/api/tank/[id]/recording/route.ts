import { recordingFor } from "@/lib/tank/service";
import { redirectOut } from "@/lib/tank/redirect";

/** The session recording, for attendees and the team only. Every open is audited. */
export async function GET(req: Request, ctx: RouteContext<"/api/tank/[id]/recording">) {
  const { id } = await ctx.params;
  return redirectOut(req, `/sessions/${id}`, (user) => recordingFor(user, id));
}
