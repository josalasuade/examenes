"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, ErrorApi } from "../api";
import { Modal } from "../Modal";

/** Llama a la API del docente; ante 401 vuelve al login. */
export async function apiAdmin<T = unknown>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  try {
    return await api<T>(ruta, opciones);
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 401 && typeof window !== "undefined" && location.pathname !== "/admin") {
      location.href = "/admin";
    }
    throw e;
  }
}

export function fechaHora(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("es-AR", { hour12: false }) : "—";
}

export function hora(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString("es-AR", { hour12: false }) : "—";
}

/** Mensajes de éxito/error de una acción. */
export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!aviso || aviso.error) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);
  const mostrar = useCallback((texto: string, error = false) => setAviso({ texto, error }), []);
  const nodo = aviso ? (
    <p className={aviso.error ? "error" : "ok"} role={aviso.error ? "alert" : "status"}>
      {aviso.texto}
    </p>
  ) : null;
  return { mostrar, nodo };
}

/** Confirmación con modal propio. Uso: const c = useConfirmar(); c.pedir({...}); {c.nodo} */
export function useConfirmar() {
  const [pedido, setPedido] = useState<{
    titulo: string;
    mensaje: ReactNode;
    boton: string;
    peligro?: boolean;
    accion: () => Promise<void> | void;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const nodo = (
    <Modal
      abierto={!!pedido}
      titulo={pedido?.titulo ?? ""}
      onCerrar={ocupado ? undefined : () => setPedido(null)}
      acciones={
        <>
          <button className="secundario" disabled={ocupado} onClick={() => setPedido(null)}>Cancelar</button>
          <button
            className={pedido?.peligro ? "peligro" : ""}
            disabled={ocupado}
            onClick={async () => {
              if (!pedido) return;
              setOcupado(true);
              setError("");
              try {
                await pedido.accion();
                setPedido(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? "Procesando…" : pedido?.boton}
          </button>
        </>
      }
    >
      {pedido?.mensaje}
      {error && <p className="error" role="alert">{error}</p>}
    </Modal>
  );
  return {
    pedir: (p: NonNullable<typeof pedido>) => {
      setError("");
      setPedido(p);
    },
    nodo,
  };
}

/** Lee un archivo de texto elegido por el usuario. */
export function leerArchivo(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsText(f, "utf-8");
  });
}

export function EstadoAsignacion({ estado }: { estado: string }) {
  const clase = estado === "entregado" ? "verde" : estado === "en_curso" ? "azul" : "";
  const texto = estado === "entregado" ? "Entregado" : estado === "en_curso" ? "Rindiendo" : "No empezó";
  return <span className={`etiqueta ${clase}`}>{texto}</span>;
}

export function EstadoExamen({ estado }: { estado: string }) {
  const clase = estado === "publicado" ? "verde" : estado === "cerrado" ? "roja" : "amarilla";
  return <span className={`etiqueta ${clase}`}>{estado === "publicado" ? "Publicado" : estado === "cerrado" ? "Cerrado" : "Borrador"}</span>;
}
