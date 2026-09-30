// Video room adapters for Tank sessions. Pick one with VIDEO_PROVIDER (see .env.example):
//   link  — the team pastes any meeting link (Zoom, Google Meet, Teams…)
//   jitsi — rooms on meet.jit.si or a self-hosted Jitsi, optionally with signed JWTs
//   daily — private Daily.co rooms with a personal meeting token per attendee
// Join URLs are built server-side at the moment someone joins, and never stored in the page.
import { createHmac, randomBytes } from "node:crypto";

export type Participant = { name: string; moderator: boolean };
export type Room = { name: string; url?: string };

export interface VideoProvider {
  name: "link" | "jitsi" | "daily";
  /** Creates (or reserves) a room for a session. */
  createRoom(opts: { startsAt: Date; endsAt: Date }): Promise<Room>;
  /** A personal URL that joins `room` as `who`. */
  joinUrl(room: Room, who: Participant, expiresAt: Date): Promise<string>;
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 10_000;
export const newRoomName = () => `rz-${randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "")}`;

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** A compact HS256 JWT, as used by Jitsi's token authentication and 8x8 JaaS-compatible setups. */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** The team pastes a meeting link for each session. */
export function linkVideo(): VideoProvider {
  return {
    name: "link",
    createRoom: async () => ({ name: "external" }),
    joinUrl: async (room) => {
      if (!room.url) throw new Error("No meeting link has been added for this session yet.");
      return room.url;
    },
  };
}

export function jitsiVideo(cfg: { baseUrl: string; appId?: string; appSecret?: string }): VideoProvider {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return {
    name: "jitsi",
    createRoom: async () => ({ name: newRoomName() }),
    joinUrl: async (room, who, expiresAt) => {
      const url = `${base}/${encodeURIComponent(room.name)}`;
      const display = `#userInfo.displayName=${encodeURIComponent(JSON.stringify(who.name))}&config.prejoinConfig.enabled=false`;
      if (!cfg.appId || !cfg.appSecret) return `${url}${display}`;
      const jwt = signJwt(
        {
          aud: "jitsi",
          iss: cfg.appId,
          sub: new URL(base).hostname,
          room: room.name,
          exp: Math.floor(expiresAt.getTime() / 1000),
          context: { user: { name: who.name, moderator: who.moderator } },
          moderator: who.moderator,
        },
        cfg.appSecret,
      );
      return `${url}?jwt=${jwt}${display}`;
    },
  };
}

export function dailyVideo(cfg: { apiKey: string; recording?: boolean }, f: Fetch = fetch): VideoProvider {
  const call = async (path: string, body: unknown) => {
    const res = await f(`https://api.daily.co/v1${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Daily API ${path}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return res.json() as Promise<Record<string, unknown>>;
  };
  return {
    name: "daily",
    createRoom: async ({ startsAt, endsAt }) => {
      const nbf = Math.floor(startsAt.getTime() / 1000) - 30 * 60;
      const exp = Math.floor(endsAt.getTime() / 1000) + 60 * 60;
      const room = await call("/rooms", {
        name: newRoomName(),
        privacy: "private",
        properties: { nbf, exp, eject_at_room_exp: true, enable_chat: true, ...(cfg.recording ? { enable_recording: "cloud" } : {}) },
      });
      return { name: String(room.name), url: String(room.url) };
    },
    joinUrl: async (room, who, expiresAt) => {
      const t = await call("/meeting-tokens", {
        properties: { room_name: room.name, user_name: who.name, is_owner: who.moderator, exp: Math.floor(expiresAt.getTime() / 1000) },
      });
      return `${room.url}?t=${String(t.token)}`;
    },
  };
}
