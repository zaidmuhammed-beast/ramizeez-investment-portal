import { describe, expect, it, vi } from "vitest";
import { httpSms, parseAddress, resendEmail, sendgridEmail, twilioSms, vonageSms } from "@/lib/messaging/providers";

type Call = { url: string; init: RequestInit };

function mockFetch(response: Response) {
  const calls: Call[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response.clone();
  }) as unknown as typeof fetch;
  return { f, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("email providers", () => {
  it("Resend posts JSON with a bearer token", async () => {
    const { f, calls } = mockFetch(json({ id: "re_123" }));
    const r = await resendEmail({ apiKey: "rk", from: "RZ <no-reply@rz.pk>" }, f).send({ to: "a@b.com", subject: "Hi", text: "Body" });
    expect(r).toEqual({ ok: true, providerMessageId: "re_123" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer rk");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ from: "RZ <no-reply@rz.pk>", to: ["a@b.com"], subject: "Hi", text: "Body" });
  });

  it("SendGrid uses structured senders and reads the message id header", async () => {
    const { f, calls } = mockFetch(new Response(null, { status: 202, headers: { "X-Message-Id": "sg_1" } }));
    const r = await sendgridEmail({ apiKey: "sk", from: "RZ <no-reply@rz.pk>" }, f).send({ to: "a@b.com", subject: "Hi", text: "Body" });
    expect(r).toEqual({ ok: true, providerMessageId: "sg_1" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.from).toEqual({ email: "no-reply@rz.pk", name: "RZ" });
    expect(body.personalizations[0].to[0].email).toBe("a@b.com");
  });

  it("reports HTTP errors without throwing", async () => {
    const { f } = mockFetch(new Response("invalid key", { status: 401 }));
    expect(await resendEmail({ apiKey: "x", from: "a@b.c" }, f).send({ to: "a@b.com", subject: "s", text: "t" })).toEqual({ ok: false, error: "HTTP 401: invalid key" });
  });

  it("reports network errors without throwing", async () => {
    const f = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    expect(await sendgridEmail({ apiKey: "x", from: "a@b.c" }, f).send({ to: "a@b.com", subject: "s", text: "t" })).toEqual({ ok: false, error: "ECONNRESET" });
  });

  it("parses sender addresses", () => {
    expect(parseAddress("no-reply@rz.pk")).toEqual({ email: "no-reply@rz.pk" });
    expect(parseAddress('"RamiZeeZ" <hi@rz.pk>')).toEqual({ email: "hi@rz.pk", name: "RamiZeeZ" });
  });
});

describe("SMS providers", () => {
  it("Twilio posts a form with basic auth", async () => {
    const { f, calls } = mockFetch(json({ sid: "SM1" }, 201));
    const r = await twilioSms({ accountSid: "AC1", authToken: "tok", from: "+15550001" }, f).send({ to: "+923001234567", text: "Code 123456" });
    expect(r).toEqual({ ok: true, providerMessageId: "SM1" });
    expect(calls[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get("To")).toBe("+923001234567");
    expect(form.get("From")).toBe("+15550001");
  });

  it("Twilio uses a Messaging Service when given an MG… sender", async () => {
    const { f, calls } = mockFetch(json({ sid: "SM2" }, 201));
    await twilioSms({ accountSid: "AC1", authToken: "tok", from: "MG123" }, f).send({ to: "+923001234567", text: "x" });
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get("MessagingServiceSid")).toBe("MG123");
    expect(form.has("From")).toBe(false);
  });

  it("Vonage strips the + and checks the per-message status", async () => {
    const { f, calls } = mockFetch(json({ messages: [{ status: "0", "message-id": "v1" }] }));
    expect(await vonageSms({ apiKey: "k", apiSecret: "s", from: "RamiZeeZ" }, f).send({ to: "+971501234567", text: "hi" })).toEqual({ ok: true, providerMessageId: "v1" });
    expect(new URLSearchParams(String(calls[0].init.body)).get("to")).toBe("971501234567");

    const bad = mockFetch(json({ messages: [{ status: "4", "error-text": "Bad credentials" }] }));
    expect(await vonageSms({ apiKey: "k", apiSecret: "s", from: "RZ" }, bad.f).send({ to: "+1", text: "x" })).toEqual({ ok: false, error: "Vonage status 4: Bad credentials" });
  });

  it("HTTP gateway fills URL placeholders (GET)", async () => {
    const { f, calls } = mockFetch(new Response("OK:1"));
    const sms = httpSms({ url: "https://gw.pk/send?to={to_local}&n={to_digits}&text={message}", method: "GET", successMatch: "OK" }, f);
    expect(await sms.send({ to: "+923001234567", text: "Code 123456 & more" })).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://gw.pk/send?to=03001234567&n=923001234567&text=Code%20123456%20%26%20more");
    expect(calls[0].init.body).toBeUndefined();
  });

  it("HTTP gateway escapes JSON bodies and sends headers (POST)", async () => {
    const { f, calls } = mockFetch(new Response("{}"));
    const sms = httpSms(
      { url: "https://gw.pk/api", method: "POST", contentType: "application/json", body: '{"to":"{to}","msg":"{message}"}', headers: { Authorization: "Bearer k" } },
      f,
    );
    await sms.send({ to: "+923001234567", text: 'Say "hi"\nnow' });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ to: "+923001234567", msg: 'Say "hi"\nnow' });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("HTTP gateway fails when the success marker is missing", async () => {
    const { f } = mockFetch(new Response("ERROR: balance"));
    const r = await httpSms({ url: "https://gw.pk", method: "GET", successMatch: "OK" }, f).send({ to: "+92300", text: "x" });
    expect(r.ok).toBe(false);
  });
});
