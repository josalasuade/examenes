import postgres from "postgres";
import { config } from "./config";

// Una sola instancia por proceso (en dev, Next recarga módulos: se guarda en globalThis).
const g = globalThis as unknown as { __sql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!g.__sql) {
    g.__sql = postgres(config.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? "5"),
      idle_timeout: 20,
      // Requerido por el pooler de Supabase en modo transacción.
      prepare: false,
      onnotice: () => {},
    });
  }
  return g.__sql;
}
