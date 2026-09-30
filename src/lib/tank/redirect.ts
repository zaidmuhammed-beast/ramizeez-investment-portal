import "server-only";
import { getSession, type CurrentUser } from "../auth/session";
import { TankError } from "./service";

/**
 * Runs a lookup that yields an external URL (a video room or recording) and redirects to it.
 * The URL is never rendered into a page, so it can't be copied from the page source.
 */
export async function redirectOut(req: Request, fallback: string, fn: (user: CurrentUser) => Promise<string>) {
  const session = await getSession();
  if (!session || session.stage !== "ACTIVE" || session.user.status !== "ACTIVE") return Response.redirect(new URL("/login", req.url), 303);
  try {
    const target = await fn(session.user);
    return new Response(null, { status: 303, headers: { Location: target, "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  } catch (e) {
    if (!(e instanceof TankError)) throw e;
    const back = new URL(fallback, req.url);
    back.searchParams.set("error", e.message);
    return Response.redirect(back, 303);
  }
}
