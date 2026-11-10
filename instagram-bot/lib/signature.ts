import { createHmac, timingSafeEqual } from "node:crypto";

/** Confere o cabeçalho X-Hub-Signature-256 enviado pela Meta. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}
