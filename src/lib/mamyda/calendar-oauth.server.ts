import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { addDays, iso, startOfDay } from "@/lib/time";
import type { CalendarSource } from "./types";

export type OAuthProvider = "google" | "outlook";

type OAuthState = {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  code_verifier: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const providers = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    clientId: () => process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim(),
    clientSecret: () => process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
    // Read and change events only; do not request calendar ACL or settings access.
    scope: "openid email https://www.googleapis.com/auth/calendar.events",
  },
  outlook: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: () =>
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID?.trim() || "common"}/oauth2/v2.0/token`,
    clientId: () => process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim(),
    clientSecret: () => process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim(),
    scope: "openid profile email offline_access User.Read Calendars.ReadWrite",
  },
} as const;

function appOrigin(): string {
  const value = process.env.BETTER_AUTH_URL?.trim();
  if (!value) throw new Error("Calendar authorization is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" && process.env.APP_ENV === "production") {
    throw new Error("Calendar authorization requires an HTTPS application URL");
  }
  return url.origin;
}

function callbackUrl(provider: OAuthProvider): string {
  // The Microsoft app registration uses "microsoft" in its public callback
  // path, while Mamyda uses "outlook" internally as the provider key.
  const pathProvider = provider === "outlook" ? "microsoft" : provider;
  return `${appOrigin()}/api/calendar/${pathProvider}/callback`;
}

function configured(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const item = providers[provider];
  const clientId = item.clientId();
  const clientSecret = item.clientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      `${provider === "google" ? "Google" : "Microsoft"} Calendar is not configured yet`,
    );
  }
  return { clientId, clientSecret };
}

function b64url(input: Buffer): string {
  return input.toString("base64url");
}

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function encryptionKey(): Buffer {
  const material =
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!material || material.length < 32)
    throw new Error("Calendar token encryption is not configured");
  return createHash("sha256").update(material).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${b64url(iv)}.${b64url(cipher.getAuthTag())}.${b64url(payload)}`;
}

function decrypt(value: string): string {
  const [version, ivText, tagText, payloadText] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !payloadText)
    throw new Error("Stored calendar authorization is invalid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function errorRedirect(provider: OAuthProvider, message: string): Response {
  const url = new URL("/settings", appOrigin());
  url.searchParams.set("calendar", "error");
  url.searchParams.set("provider", provider);
  url.searchParams.set("message", message.slice(0, 160));
  return Response.redirect(url, 302);
}

export async function beginCalendarOAuth(userId: string, provider: OAuthProvider): Promise<string> {
  const { clientId } = configured(provider);
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const sql = await getSql();
  await sql`delete from calendar_oauth_states where expires_at < now()`;
  await sql`
    insert into calendar_oauth_states (id, user_id, provider, state_hash, code_verifier, expires_at)
    values (${nid()}, ${userId}, ${provider}, ${digest(state)}, ${verifier}, now() + interval '10 minutes')
  `;
  const url = new URL(providers[provider].authorize);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", providers[provider].scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "consent");
  if (provider === "google") url.searchParams.set("access_type", "offline");
  return url.toString();
}

async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = configured(provider);
  const tokenUrl =
    typeof providers[provider].token === "function"
      ? providers[provider].token()
      : providers[provider].token;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: callbackUrl(provider),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "The calendar provider did not return an authorization token",
    );
  }
  return data;
}

async function accountEmail(provider: OAuthProvider, token: string): Promise<string | null> {
  const response = await fetch(
    provider === "google"
      ? "https://www.googleapis.com/oauth2/v3/userinfo"
      : "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    email?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  return data.email ?? data.mail ?? data.userPrincipalName ?? null;
}

export async function completeCalendarOAuth(
  provider: OAuthProvider,
  request: Request,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const code = params.get("code");
  if (params.get("error") || !state || !code)
    return errorRedirect(
      provider,
      params.get("error_description") || "Authorization was cancelled",
    );
  const sql = await getSql();
  const rows = await sql<OAuthState>`
    delete from calendar_oauth_states
    where state_hash = ${digest(state)} and provider = ${provider} and expires_at > now()
    returning id, user_id, provider, code_verifier
  `;
  const attempt = rows[0];
  if (!attempt)
    return errorRedirect(
      provider,
      "This authorization link has expired. Start again from Settings.",
    );
  try {
    const tokens = await exchangeCode(provider, code, attempt.code_verifier);
    const email = await accountEmail(provider, tokens.access_token!);
    const expiresAt = new Date(
      Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000,
    ).toISOString();
    await sql`
      insert into calendar_oauth_connections (user_id, provider, access_token_cipher, refresh_token_cipher, expires_at, account_email)
      values (${attempt.user_id}, ${provider}, ${encrypt(tokens.access_token!)}, ${encrypt(tokens.refresh_token!)}, ${expiresAt}, ${email})
      on conflict (user_id, provider) do update set
        access_token_cipher = excluded.access_token_cipher,
        refresh_token_cipher = excluded.refresh_token_cipher,
        expires_at = excluded.expires_at,
        account_email = excluded.account_email,
        updated_at = now()
    `;
    const existing = await sql<Record<string, unknown>>`
      select * from calendar_sources where user_id = ${attempt.user_id} and provider = ${provider} limit 1
    `;
    if (!existing[0]) {
      await sql`
        insert into calendar_sources (id, user_id, provider, name)
        values (${nid()}, ${attempt.user_id}, ${provider}, ${provider === "google" ? "Google Calendar" : "Outlook Calendar"})
      `;
    }
    const url = new URL("/settings", appOrigin());
    url.searchParams.set("calendar", "connected");
    url.searchParams.set("provider", provider);
    return Response.redirect(url, 302);
  } catch (error) {
    return errorRedirect(
      provider,
      error instanceof Error ? error.message : "Calendar authorization failed",
    );
  }
}

type Connection = {
  access_token_cipher: string;
  refresh_token_cipher: string;
  expires_at: string | Date;
};

async function refreshToken(provider: OAuthProvider, refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = configured(provider);
  const tokenUrl =
    typeof providers[provider].token === "function"
      ? providers[provider].token()
      : providers[provider].token;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !data.access_token)
    throw new Error(
      data.error_description ||
        data.error ||
        "Calendar authorization expired; reconnect it in Settings",
    );
  return data;
}

async function usableAccessToken(userId: string, provider: OAuthProvider): Promise<string> {
  const sql = await getSql();
  const rows =
    await sql<Connection>`select access_token_cipher, refresh_token_cipher, expires_at from calendar_oauth_connections where user_id = ${userId} and provider = ${provider}`;
  const connection = rows[0];
  if (!connection) throw new Error("Calendar is not connected");
  if (new Date(connection.expires_at).getTime() > Date.now() + 60_000)
    return decrypt(connection.access_token_cipher);
  const refresh = decrypt(connection.refresh_token_cipher);
  const data = await refreshToken(provider, refresh);
  const nextRefresh = data.refresh_token || refresh;
  const expiresAt = new Date(
    Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000,
  ).toISOString();
  await sql`update calendar_oauth_connections set access_token_cipher = ${encrypt(data.access_token!)}, refresh_token_cipher = ${encrypt(nextRefresh)}, expires_at = ${expiresAt}, updated_at = now() where user_id = ${userId} and provider = ${provider}`;
  return data.access_token!;
}

export async function listOAuthEvents(userId: string, source: CalendarSource): Promise<unknown[]> {
  const provider = source.provider as OAuthProvider;
  const token = await usableAccessToken(userId, provider);
  const timeMin = iso(addDays(startOfDay(new Date()), -14));
  const timeMax = iso(addDays(startOfDay(new Date()), 90));
  const url =
    provider === "google"
      ? new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events")
      : new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  if (provider === "google") {
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
  } else {
    url.searchParams.set("startDateTime", timeMin);
    url.searchParams.set("endDateTime", timeMax);
    url.searchParams.set("$top", "250");
  }
  const { fetchCalendarPages } = await import("./calendar-pages.server");
  return fetchCalendarPages(provider, url, token);
}

export type CalendarEventWrite = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

function eventDates(input: CalendarEventWrite) {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!input.title.trim()) throw new Error("Add an event title.");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error("Choose a valid end time after the start time.");
  }
  return { start, end };
}

export function providerEventBody(provider: OAuthProvider, input: CalendarEventWrite) {
  const { start, end } = eventDates(input);
  if (provider === "google") {
    return {
      summary: input.title.trim(),
      description: input.description,
      location: input.location,
      start: input.allDay
        ? { date: start.toISOString().slice(0, 10) }
        : { dateTime: start.toISOString() },
      end: input.allDay
        ? { date: end.toISOString().slice(0, 10) }
        : { dateTime: end.toISOString() },
    };
  }
  return {
    subject: input.title.trim(),
    body: { contentType: "text", content: input.description },
    location: { displayName: input.location },
    start: {
      dateTime: input.allDay ? `${start.toISOString().slice(0, 10)}T00:00:00` : start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: input.allDay ? `${end.toISOString().slice(0, 10)}T00:00:00` : end.toISOString(),
      timeZone: "UTC",
    },
    isAllDay: input.allDay,
  };
}

async function writeProviderEvent(
  userId: string,
  provider: OAuthProvider,
  input: CalendarEventWrite,
  externalId?: string,
): Promise<{ externalId: string; event: Record<string, unknown> }> {
  const token = await usableAccessToken(userId, provider);
  return sendProviderEvent(provider, token, input, externalId);
}

export async function sendProviderEvent(
  provider: OAuthProvider,
  token: string,
  input: CalendarEventWrite,
  externalId?: string,
  fetcher: typeof fetch = fetch,
): Promise<{ externalId: string; event: Record<string, unknown> }> {
  const url =
    provider === "google"
      ? new URL(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events${externalId ? `/${encodeURIComponent(externalId)}` : ""}`,
        )
      : new URL(
          `https://graph.microsoft.com/v1.0/me/events${externalId ? `/${encodeURIComponent(externalId)}` : ""}`,
        );
  const response = await fetcher(url, {
    method: externalId ? "PATCH" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(providerEventBody(provider, input)),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
    };
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "The calendar denied this change. Reconnect it in Settings and grant event access, then retry.",
      );
    }
    throw new Error(
      detail.error?.message ||
        detail.message ||
        `Calendar provider rejected the change (${response.status}).`,
    );
  }
  const event = (await response.json()) as Record<string, unknown> & { id?: string };
  if (!event.id)
    throw new Error(
      "The calendar saved the event but did not return its identifier. Sync the calendar to refresh it.",
    );
  return { externalId: event.id, event };
}

export function createProviderEvent(
  userId: string,
  provider: OAuthProvider,
  input: CalendarEventWrite,
) {
  return writeProviderEvent(userId, provider, input);
}

export function updateProviderEvent(
  userId: string,
  provider: OAuthProvider,
  externalId: string,
  input: CalendarEventWrite,
) {
  return writeProviderEvent(userId, provider, input, externalId);
}
