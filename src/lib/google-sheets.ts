import "server-only";

import { createSign } from "node:crypto";

export class SheetsReadError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SheetsReadError";
  }
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new SheetsReadError("GOOGLE_CREDENTIALS_MISSING");

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    })),
  ].join(".");
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new SheetsReadError("GOOGLE_AUTH_UNAVAILABLE");
  }
  if (!response.ok) throw new SheetsReadError("GOOGLE_AUTH_REJECTED");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SheetsReadError("GOOGLE_AUTH_INVALID_RESPONSE");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  ) {
    throw new SheetsReadError("GOOGLE_AUTH_INVALID_RESPONSE");
  }
  return payload.access_token;
}

export async function readMainSheet(): Promise<unknown[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new SheetsReadError("SPREADSHEET_ID_MISSING");

  const accessToken = await getAccessToken();
  const range = encodeURIComponent("MainSheet");
  let response: Response;
  try {
    response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
  } catch {
    throw new SheetsReadError("GOOGLE_SHEETS_UNAVAILABLE");
  }
  if (!response.ok) throw new SheetsReadError("GOOGLE_SHEETS_REJECTED");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SheetsReadError("GOOGLE_SHEETS_INVALID_RESPONSE");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("values" in payload) ||
    !Array.isArray(payload.values) ||
    payload.values.some((row) => !Array.isArray(row))
  ) {
    throw new SheetsReadError("GOOGLE_SHEETS_INVALID_RESPONSE");
  }
  return payload.values as unknown[][];
}
