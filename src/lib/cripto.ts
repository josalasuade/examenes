import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Firma un payload JSON: base64url(json).hmac */
export function firmar(payload: object, secreto: string): string {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secreto).update(cuerpo).digest("base64url");
  return `${cuerpo}.${mac}`;
}

export function verificarFirma<T>(token: string, secreto: string): T | null {
  const [cuerpo, mac] = token.split(".");
  if (!cuerpo || !mac) return null;
  const esperado = createHmac("sha256", secreto).update(cuerpo).digest("base64url");
  if (!iguales(mac, esperado)) return null;
  try {
    return JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
