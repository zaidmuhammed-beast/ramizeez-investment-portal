import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { approveSeatBlocker, interestBlocker, joinWindowOpen, scheduleErrors, seatBlocker, tankPhase, type SeatInput, type Timing } from "@/lib/tank/rules";
import { dailyVideo, jitsiVideo, linkVideo, newRoomName, signJwt } from "@/lib/tank/video";
import { campaignErrors, campaignRates, dueDate, duePeriods, healthError, indicativeReturn, isOverdue, periodLabel, periodOf, reportErrors, reportSchedule, type ReturnInput } from "@/lib/execution/rules";
import { en } from "@/i18n/dictionaries/en";
import { ur } from "@/i18n/dictionaries/ur";
import { dirOf, fill, isLocale } from "@/i18n/config";

const at = (iso: string) => new Date(iso);
const session: Timing = { startsAt: at("2026-10-10T15:00:00Z"), durationMin: 90, status: "SCHEDULED" };

describe("tank session timing", () => {
  it("moves through its phases", () => {
    expect(tankPhase(session, at("2026-10-10T14:00:00Z"))).toBe("UPCOMING");
    expect(tankPhase(session, at("2026-10-10T14:50:00Z"))).toBe("OPENING");
    expect(tankPhase(session, at("2026-10-10T15:30:00Z"))).toBe("LIVE");
    expect(tankPhase(session, at("2026-10-10T16:31:00Z"))).toBe("ENDED");
    expect(tankPhase({ ...session, status: "COMPLETED" }, at("2026-10-10T15:30:00Z"))).toBe("COMPLETED");
    expect(tankPhase({ ...session, status: "CANCELLED" }, at("2026-10-10T14:00:00Z"))).toBe("CANCELLED");
  });

  it("opens the join link 15 minutes before and closes it 15 minutes after", () => {
    expect(joinWindowOpen(session, at("2026-10-10T14:44:00Z"))).toBe(false);
    expect(joinWindowOpen(session, at("2026-10-10T14:46:00Z"))).toBe(true);
    expect(joinWindowOpen(session, at("2026-10-10T16:40:00Z"))).toBe(true);
    expect(joinWindowOpen(session, at("2026-10-10T16:46:00Z"))).toBe(false);
    expect(joinWindowOpen({ ...session, status: "CANCELLED" }, at("2026-10-10T15:10:00Z"))).toBe(false);
  });

  it("validates a schedule", () => {
    const now = at("2026-10-01T10:00:00Z");
    expect(scheduleErrors({ title: "Food Tank", startsAt: at("2026-10-10T15:00:00Z"), durationMin: 90, capacity: 20, pitchIds: ["a"] }, now)).toEqual({});
    const bad = scheduleErrors({ title: "Tk", startsAt: at("2026-10-01T10:30:00Z"), durationMin: 5, capacity: 0, pitchIds: [] }, now);
    expect(Object.keys(bad).sort()).toEqual(["capacity", "durationMin", "pitchIds", "startsAt", "title"]);
    expect(scheduleErrors({ title: "Food Tank", startsAt: at("2026-10-10T15:00:00Z"), durationMin: 90, capacity: 20, pitchIds: ["1", "2", "3", "4", "5", "6", "7"] }, now).pitchIds).toMatch(/At most 6/);
  });
});

describe("tank seats and interest", () => {
  const ok: SeatInput = { isInvestor: true, tier: 4, ready: true, eligiblePitches: 2, phase: "UPCOMING", existing: null };
  it("admits only Tier 4 investors who match a pitch", () => {
    expect(seatBlocker(ok)).toBeNull();
    expect(seatBlocker({ ...ok, isInvestor: false })).toMatch(/Only investors/);
    expect(seatBlocker({ ...ok, tier: 3 })).toMatch(/Tier 4/);
    expect(seatBlocker({ ...ok, eligiblePitches: 0 })).toMatch(/None of this session's pitches/);
    expect(seatBlocker({ ...ok, phase: "LIVE" })).toMatch(/closed/);
    expect(seatBlocker({ ...ok, existing: "REQUESTED" })).toMatch(/already/);
    expect(seatBlocker({ ...ok, existing: "DECLINED" })).toMatch(/declined/);
    expect(seatBlocker({ ...ok, existing: "CANCELLED" })).toBeNull();
  });
  it("respects capacity", () => {
    expect(approveSeatBlocker(19, 20, "UPCOMING")).toBeNull();
    expect(approveSeatBlocker(20, 20, "UPCOMING")).toMatch(/All 20 seats/);
    expect(approveSeatBlocker(0, 20, "COMPLETED")).toMatch(/closed/);
  });
  it("accepts “I'm in” only from attendees, within the pitch's limits", () => {
    const base = { phase: "LIVE" as const, joined: true, amount: 500_000, minTicket: 100_000, maxAmount: 1_000_000 };
    expect(interestBlocker(base)).toBeNull();
    expect(interestBlocker({ ...base, phase: "UPCOMING" })).toMatch(/starts/);
    expect(interestBlocker({ ...base, joined: false })).toMatch(/Join/);
    expect(interestBlocker({ ...base, amount: 50_000 })).toMatch(/minimum/);
    expect(interestBlocker({ ...base, amount: 2_000_000 })).toMatch(/more than/);
  });
});

describe("video providers", () => {
  const who = { name: "Sara Qureshi (Investor)", moderator: false };
  const exp = at("2026-10-10T17:30:00Z");

  it("creates unguessable room names", () => {
    const a = newRoomName();
    expect(a).toMatch(/^rz-[a-z0-9]{12,}$/);
    expect(newRoomName()).not.toBe(a);
  });

  it("uses the pasted link", async () => {
    const v = linkVideo();
    expect(await v.joinUrl({ name: "external", url: "https://zoom.us/j/123" }, who, exp)).toBe("https://zoom.us/j/123");
    await expect(v.joinUrl({ name: "external" }, who, exp)).rejects.toThrow(/No meeting link/);
  });

  it("builds Jitsi links, signing a JWT when configured", async () => {
    const open = jitsiVideo({ baseUrl: "https://meet.jit.si/" });
    const url = await open.joinUrl({ name: "rz-room" }, who, exp);
    expect(url.startsWith("https://meet.jit.si/rz-room#userInfo.displayName=")).toBe(true);
    expect(url).not.toContain("jwt=");

    const signed = jitsiVideo({ baseUrl: "https://video.ramizeez.com", appId: "rz", appSecret: "s3cret" });
    const jwt = new URL(await signed.joinUrl({ name: "rz-room" }, { ...who, moderator: true }, exp)).searchParams.get("jwt")!;
    const [h, p, sig] = jwt.split(".");
    expect(createHmac("sha256", "s3cret").update(`${h}.${p}`).digest("base64url")).toBe(sig);
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims).toMatchObject({ aud: "jitsi", iss: "rz", sub: "video.ramizeez.com", room: "rz-room", exp: exp.getTime() / 1000, moderator: true });
    expect(claims.context.user.name).toBe("Sara Qureshi (Investor)");
  });

  it("signs compact HS256 tokens", () => {
    expect(signJwt({ a: 1 }, "k").split(".")).toHaveLength(3);
  });

  it("creates private Daily rooms and personal tokens", async () => {
    const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
      return new Response(JSON.stringify(url.endsWith("/rooms") ? { name: "rz-abc", url: "https://rz.daily.co/rz-abc" } : { token: "TOKEN" }), { status: 200 });
    }) as typeof fetch;
    const v = dailyVideo({ apiKey: "key", recording: true }, fake);
    const room = await v.createRoom({ startsAt: at("2026-10-10T15:00:00Z"), endsAt: at("2026-10-10T16:30:00Z") });
    expect(room).toEqual({ name: "rz-abc", url: "https://rz.daily.co/rz-abc" });
    expect(calls[0].body).toMatchObject({ privacy: "private", properties: { enable_recording: "cloud", eject_at_room_exp: true } });
    expect(calls[0].auth).toBe("Bearer key");
    expect(await v.joinUrl(room, who, exp)).toBe("https://rz.daily.co/rz-abc?t=TOKEN");
    expect(calls[1].body).toMatchObject({ properties: { room_name: "rz-abc", user_name: "Sara Qureshi (Investor)", is_owner: false } });
  });

  it("surfaces Daily API errors", async () => {
    const fail = (async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    await expect(dailyVideo({ apiKey: "x" }, fail).createRoom({ startsAt: exp, endsAt: exp })).rejects.toThrow(/HTTP 401/);
  });
});

describe("monthly reports", () => {
  it("lists every ended month since funding", () => {
    expect(duePeriods(at("2026-08-20T00:00:00Z"), at("2026-10-05T00:00:00Z"))).toEqual(["2026-08", "2026-09"]);
    expect(duePeriods(at("2026-09-20T00:00:00Z"), at("2026-09-30T00:00:00Z"))).toEqual([]);
    expect(duePeriods(at("2025-12-10T00:00:00Z"), at("2026-02-01T00:00:00Z"))).toEqual(["2025-12", "2026-01"]);
    expect(periodOf(at("2026-01-31T23:00:00Z"))).toBe("2026-01");
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(dueDate("2026-12").toISOString()).toBe("2027-01-10T23:59:59.000Z");
  });

  it("marks reports due, overdue, submitted and published", () => {
    const schedule = reportSchedule(at("2026-07-15T00:00:00Z"), at("2026-10-05T00:00:00Z"), [
      { period: "2026-07", status: "PUBLISHED" },
      { period: "2026-08", status: "RETURNED" },
    ]);
    expect(schedule.map((x) => [x.period, x.state])).toEqual([
      ["2026-09", "DUE"],
      ["2026-08", "OVERDUE"],
      ["2026-07", "PUBLISHED"],
    ]);
  });

  it("validates a report", () => {
    const good = { period: "2026-09", revenue: 120_000, costs: 90_000, cashInBank: 300_000, customers: 140, highlights: "First 140 paying subscribers onboarded", challenges: "Van repair delays" };
    expect(reportErrors(good, ["2026-09"])).toEqual({});
    expect(Object.keys(reportErrors({ ...good, period: "2026-10", revenue: -1, costs: NaN, customers: 1.5, highlights: "ok", challenges: "" }, ["2026-09"])).sort()).toEqual(["challenges", "costs", "customers", "highlights", "period", "revenue"]);
  });

  it("works out an indicative return per structure", () => {
    const base: ReturnInput = { dealType: "MUSHARAKAH", terms: { profitSharePercent: 40, termMonths: 36 }, amount: 500_000, fundedTotal: 1_000_000, founderCapital: 250_000, revenue: 300_000, costs: 200_000, earlierShare: 0 };
    // Profit 100k × 40% to investors × half the round.
    expect(indicativeReturn(base)).toEqual({ label: "Your indicative profit share", value: 20_000 });
    // A 100k loss is shared by capital: 500k of 1.25M.
    expect(indicativeReturn({ ...base, costs: 400_000 }).value).toBe(-40_000);
    expect(indicativeReturn({ ...base, dealType: "MUDARABAH", costs: 400_000 }).value).toBe(-50_000);
    const rs = { ...base, dealType: "REVENUE_SHARE" as const, terms: { revenueSharePercent: 10, returnCapMultiple: 1.5, termMonths: 48 } };
    expect(indicativeReturn(rs).value).toBe(15_000);
    // Capped at 1.5 × 500k = 750k in total.
    expect(indicativeReturn({ ...rs, earlierShare: 740_000 }).value).toBe(10_000);
    expect(indicativeReturn({ ...rs, earlierShare: 750_000 }).value).toBe(0);
    expect(indicativeReturn({ ...base, dealType: "EQUITY", terms: { equityPercent: 10, valuation: 5_000_000 } })).toEqual({ label: "Profit attributable to your stake (not distributed)", value: 10_000 });
  });
});

describe("execution and marketing", () => {
  it("requires a reason for amber and red", () => {
    expect(healthError("GREEN", null)).toBeNull();
    expect(healthError("RED", "late")).toMatch(/at least 10/);
    expect(healthError("AMBER", "Supplier delay of two weeks")).toBeNull();
  });
  it("flags overdue tasks", () => {
    const now = at("2026-10-05T00:00:00Z");
    expect(isOverdue({ status: "TODO", dueDate: at("2026-10-01T00:00:00Z") }, now)).toBe(true);
    expect(isOverdue({ status: "DONE", dueDate: at("2026-10-01T00:00:00Z") }, now)).toBe(false);
    expect(isOverdue({ status: "TODO", dueDate: null }, now)).toBe(false);
  });
  it("validates campaigns and computes their rates", () => {
    expect(campaignErrors({ name: "Launch", channel: "Instagram", objective: "300 subscribers in DHA", startDate: at("2026-10-01"), endDate: at("2026-10-31"), budget: 150_000 })).toEqual({});
    expect(Object.keys(campaignErrors({ name: "x", channel: "Fax", objective: "sell", startDate: at("2026-10-10"), endDate: at("2026-10-01"), budget: -5 })).sort()).toEqual(["budget", "channel", "endDate", "name", "objective"]);
    expect(campaignRates({ reach: 20_000, leads: 400, conversions: 100, budget: 150_000 })).toEqual({ leadRate: 2, conversionRate: 25, costPerConversion: 1500 });
    expect(campaignRates({ reach: null, leads: 10, conversions: 0, budget: 1000 })).toEqual({ leadRate: null, conversionRate: 0, costPerConversion: null });
  });
});

describe("Urdu translation", () => {
  const shape = (v: unknown): unknown => (Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);

  it("has exactly the same keys and list lengths as English", () => {
    const ui = (d: typeof en) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== "messages" && k !== "patterns"));
    expect(shape(ui(ur))).toEqual(shape(ui(en)));
  });

  it("keeps every placeholder", () => {
    const strings = (v: unknown, path = ""): [string, string][] =>
      typeof v === "string" ? [[path, v]] : Array.isArray(v) ? v.flatMap((x, i) => strings(x, `${path}.${i}`)) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => strings(x, `${path}.${k}`)) : [];
    const urMap = new Map(strings(ur));
    for (const [path, text] of strings(en)) {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(urMap.get(path) ?? ""), path).toEqual(vars(text));
    }
  });

  it("is written in Urdu script", () => {
    expect(ur.auth.login.title).toMatch(/[؀-ۿ]/);
    expect(ur.nav.dashboard).not.toBe(en.nav.dashboard);
  });

  it("translates server messages, including ones with numbers", () => {
    expect(ur.messages["Incorrect email or password"]).toBeTruthy();
    const [pattern, out] = Object.entries(ur.patterns)[0];
    const m = "Too many attempts. Try again in 3 minute(s).".match(new RegExp(`^${pattern}$`));
    expect(m?.[1]).toBe("3");
    expect(out.replace("$1", m![1])).toContain("3");
  });

  it("fills placeholders and knows text direction", () => {
    expect(fill("Welcome, {name}", { name: "Ayesha" })).toBe("Welcome, Ayesha");
    expect(fill("{a} {b}", { a: 1 })).toBe("1 {b}");
    expect(dirOf("ur")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
