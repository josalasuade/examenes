import { createTransport } from "nodemailer";
import { config } from "./config";

// Envío de mails por SMTP.
// * Desarrollo: Mailpit (docker compose) captura los mails en http://localhost:8025.
// * Producción: SMTP de Gmail (smtp.gmail.com:587) con la cuenta institucional
//   del docente y una contraseña de aplicación. Verificar que el Workspace de
//   UADE permita contraseñas de aplicación.

let transporte: ReturnType<typeof crearTransporte> | null = null;

function crearTransporte() {
  return createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

function obtenerTransporte() {
  if (!config.smtp.host) throw new Error("SMTP no configurado (falta SMTP_HOST).");
  transporte ??= crearTransporte();
  return transporte;
}

export async function enviarMail(m: {
  para: string;
  asunto: string;
  texto: string;
  adjunto?: { nombre: string; contenido: Buffer };
}): Promise<void> {
  await obtenerTransporte().sendMail({
    from: config.smtp.from,
    to: m.para,
    subject: m.asunto,
    text: m.texto,
    attachments: m.adjunto ? [{ filename: m.adjunto.nombre, content: m.adjunto.contenido, contentType: "application/pdf" }] : [],
  });
}
