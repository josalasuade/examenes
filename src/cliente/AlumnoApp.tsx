"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ErrorApi, hayJsApiSeb } from "./api";
import { Editor, type InfoPegado } from "./Editor";
import { Modal } from "./Modal";

type Base = {
  alumno: { nombre: string; lu: string };
  examen: { materia: string; docente: string; instancia: string; fecha: string; duracionMin: number; consignasGenerales: string };
  carrera: string | null;
  sinSeb: boolean;
  servidorAhora: string;
};
type Consigna = { id: string; orden: number; titulo: string; parte: string | null; puntaje: number; enunciadoHtml: string };
type Estado =
  | (Base & { estado: "pendiente"; carreras: string[] })
  | (Base & {
      estado: "en_curso";
      venceEn: string;
      tema: { numero: number; titulo: string; casoHtml: string };
      consignas: Consigna[];
      respuestas: Record<string, string>;
    })
  | (Base & { estado: "entregado"; entrega: { entregadoEn: string; codigo: string } });

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { hour12: false });
}

export function AlumnoApp() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [vista, setVista] = useState<"cargando" | "login" | "app" | "error">("cargando");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setEstado(await api<Estado>("/api/alumno/estado"));
      setVista("app");
    } catch (e) {
      if (e instanceof ErrorApi && (e.status === 401 || e.codigo === "examen_cerrado")) {
        setVista("login");
        if (e.codigo === "examen_cerrado") setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Error");
        setVista("error");
      }
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (vista === "cargando") return <div className="centro"><p>Cargando…</p></div>;
  if (vista === "error")
    return (
      <div className="centro">
        <div className="tarjeta">
          <h1>No se pudo cargar el examen</h1>
          <p className="error">{error}</p>
          <button onClick={() => { setVista("cargando"); cargar(); }}>Reintentar</button>
        </div>
      </div>
    );
  if (vista === "login" || !estado) return <Login onIngreso={cargar} errorInicial={error} />;
  if (estado.estado === "pendiente") return <Inicio estado={estado} onComenzar={cargar} />;
  if (estado.estado === "en_curso") return <Examen estado={estado} onTerminado={cargar} />;
  return <Entregado estado={estado} />;
}

// ---------------------------------------------------------------------------

function Login({ onIngreso, errorInicial }: { onIngreso: () => void; errorInicial: string }) {
  const [codigo, setCodigo] = useState("");
  const [lu, setLu] = useState("");
  const [error, setError] = useState(errorInicial);
  const [enviando, setEnviando] = useState(false);
  const [reingreso, setReingreso] = useState<{ id: string; secreto: string } | null>(null);
  const [rechazado, setRechazado] = useState(false);

  useEffect(() => {
    if (!reingreso) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ estado: string }>(`/api/alumno/reingreso/${reingreso.id}`, { cuerpo: { secreto: reingreso.secreto } });
        if (r.estado === "ok") {
          clearInterval(t);
          onIngreso();
        } else if (r.estado === "rechazada") {
          clearInterval(t);
          setReingreso(null);
          setRechazado(true);
        }
      } catch (e) {
        if (e instanceof ErrorApi && e.status !== 0) {
          clearInterval(t);
          setReingreso(null);
          setError(e.message);
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [reingreso, onIngreso]);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRechazado(false);
    setEnviando(true);
    try {
      const r = await api<{ estado: string; solicitudId?: string; secreto?: string }>("/api/alumno/ingreso", {
        cuerpo: { codigo, lu },
      });
      if (r.estado === "ok") onIngreso();
      else setReingreso({ id: r.solicitudId!, secreto: r.secreto! });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  }

  if (reingreso)
    return (
      <div className="centro">
        <div className="tarjeta">
          <h1>Reingreso pendiente</h1>
          <p>
            Ya existe una sesión para tu LU. Por seguridad, el docente tiene que aprobar tu reingreso.
            <strong> Avisale al docente</strong> y esperá en esta pantalla.
          </p>
          <p className="sutil">Tu tiempo de examen sigue corriendo.</p>
          <div className="spinner" aria-label="Esperando aprobación" />
        </div>
      </div>
    );

  return (
    <div className="centro">
      <form className="tarjeta" onSubmit={ingresar}>
        <h1>Acceso al examen</h1>
        <p>Ingresá el código que te da el docente y tu LU.</p>
        <label>
          Código del examen
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} autoComplete="off" required maxLength={50} autoFocus />
        </label>
        <label>
          LU (legajo)
          <input value={lu} onChange={(e) => setLu(e.target.value.trim())} inputMode="numeric" autoComplete="off" required maxLength={30} />
        </label>
        <button type="submit" disabled={enviando}>{enviando ? "Verificando…" : "Ingresar"}</button>
        {rechazado && <p className="error">El docente rechazó el reingreso. Hablá con el docente.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!hayJsApiSeb() && <p className="sutil">Si este examen requiere Safe Exam Browser, abrilo con el archivo .seb del examen.</p>}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Inicio({ estado, onComenzar }: { estado: Extract<Estado, { estado: "pendiente" }>; onComenzar: () => void }) {
  const [carrera, setCarrera] = useState(estado.carrera ?? "");
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const ex = estado.examen;

  async function comenzar() {
    setError("");
    try {
      if (estado.sinSeb && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      await api("/api/alumno/comenzar", { cuerpo: { carrera } });
      onComenzar();
    } catch (e) {
      setConfirmar(false);
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="centro">
      <div className="tarjeta ancha">
        <h1>{ex.materia} — {ex.instancia}</h1>
        <p><strong>{estado.alumno.nombre}</strong> · LU {estado.alumno.lu}</p>
        <p>Duración: <strong>{ex.duracionMin} minutos</strong>, desde que comenzás.</p>
        {ex.consignasGenerales && <pre className="consignas-generales">{ex.consignasGenerales}</pre>}
        <label>
          Carrera (obligatorio)
          {estado.carreras.length ? (
            <select value={carrera} onChange={(e) => setCarrera(e.target.value)} required>
              <option value="">Elegí tu carrera…</option>
              {estado.carreras.map((c) => <option key={c}>{c}</option>)}
            </select>
          ) : (
            <input value={carrera} onChange={(e) => setCarrera(e.target.value)} maxLength={200} />
          )}
        </label>
        <button disabled={!carrera.trim()} onClick={() => setConfirmar(true)}>Comenzar examen</button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <Modal
        abierto={confirmar}
        titulo="¿Comenzar el examen?"
        onCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <button className="secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button onClick={comenzar}>Comenzar</button>
          </>
        }
      >
        <p>Al comenzar se muestra el caso y empieza a correr el tiempo ({ex.duracionMin} minutos). El tiempo no se detiene aunque cierres la ventana.</p>
        {estado.sinSeb && <p>Rendís sin Safe Exam Browser: el examen se hace en <strong>pantalla completa</strong> y se registra cada vez que salís de la ventana.</p>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

type EventoCola = { tipo: string; consignaId?: string; detalle: Record<string, unknown>; ts: string };
type Metricas = { teclas: number; pegadoExterno: number; pegadoInterno: number };

function normalizar(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function Examen({ estado, onTerminado }: { estado: Extract<Estado, { estado: "en_curso" }>; onTerminado: () => void }) {
  const desfase = useRef(new Date(estado.servidorAhora).getTime() - Date.now());
  const vence = new Date(estado.venceEn).getTime();
  const [restante, setRestante] = useState(() => Math.max(0, Math.floor((vence - Date.now() - desfase.current) / 1000)));
  const [estadoGuardado, setEstadoGuardado] = useState<{ texto: string; error?: boolean }>({ texto: "Sin cambios" });
  const [confirmarEntrega, setConfirmarEntrega] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [errorEntrega, setErrorEntrega] = useState("");
  const [fueraDePantallaCompleta, setFueraDePantallaCompleta] = useState(false);

  const respuestas = useRef<Record<string, string>>({ ...estado.respuestas });
  const sucias = useRef(new Set<string>());
  const metricas = useRef<Record<string, Metricas>>({});
  const cola = useRef<EventoCola[]>([]);
  const copiados = useRef<string[]>([]);
  const guardando = useRef(false);
  const terminado = useRef(false);

  const registrar = useCallback((tipo: string, detalle: Record<string, unknown>, consignaId?: string) => {
    cola.current.push({ tipo, detalle, consignaId, ts: new Date().toISOString() });
  }, []);

  const m = (id: string) => (metricas.current[id] ??= { teclas: 0, pegadoExterno: 0, pegadoInterno: 0 });

  const enviarEventos = useCallback(async () => {
    if (!cola.current.length) return;
    const lote = cola.current.splice(0, 100);
    try {
      await api("/api/alumno/eventos", { cuerpo: { eventos: lote } });
    } catch {
      cola.current.unshift(...lote);
    }
  }, []);

  const guardar = useCallback(async () => {
    if (guardando.current || !sucias.current.size) return;
    guardando.current = true;
    try {
      for (const id of [...sucias.current]) {
        const html = respuestas.current[id];
        const met = { ...m(id) };
        sucias.current.delete(id);
        try {
          const r = await api<{ guardadoEn: string }>("/api/alumno/respuesta", { metodo: "PUT", cuerpo: { consignaId: id, html, metricas: met } });
          const actual = m(id);
          actual.teclas -= met.teclas;
          actual.pegadoExterno -= met.pegadoExterno;
          actual.pegadoInterno -= met.pegadoInterno;
          setEstadoGuardado({ texto: `Guardado ${new Date(r.guardadoEn).toLocaleTimeString("es-AR", { hour12: false })}` });
        } catch (e) {
          sucias.current.add(id);
          if (e instanceof ErrorApi && (e.codigo === "vencido" || e.codigo === "entregado" || e.status === 401)) {
            terminado.current = true;
            onTerminado();
            return;
          }
          setEstadoGuardado({ texto: e instanceof Error ? e.message : "Error al guardar", error: true });
          return;
        }
      }
    } finally {
      guardando.current = false;
    }
  }, [onTerminado]);

  // Autoguardado y envío de eventos periódicos.
  useEffect(() => {
    const t1 = setInterval(guardar, 3000);
    const t2 = setInterval(enviarEventos, 5000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [guardar, enviarEventos]);

  // Contador.
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((vence - Date.now() - desfase.current) / 1000));
      setRestante(s);
      if (s === 0 && !terminado.current) {
        terminado.current = true;
        clearInterval(t);
        (async () => {
          await guardar();
          await enviarEventos();
          setTimeout(onTerminado, 1500);
        })();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [vence, guardar, enviarEventos, onTerminado]);

  // Monitoreo: salidas de la ventana, copias internas, pantalla completa.
  useEffect(() => {
    let salidaDesde: number | null = null;
    let motivo = "";
    const salir = (mot: string) => {
      if (salidaDesde === null) {
        salidaDesde = Date.now();
        motivo = mot;
      }
    };
    const volver = () => {
      if (salidaDesde !== null) {
        registrar("salida", { duracionMs: Date.now() - salidaDesde, motivo, desde: new Date(salidaDesde).toISOString() });
        salidaDesde = null;
        enviarEventos();
      }
    };
    const onBlur = () => salir("foco");
    const onVis = () => (document.hidden ? salir("pestaña_oculta") : volver());
    const onCopia = () => {
      const t = normalizar(window.getSelection()?.toString() ?? "");
      if (t) copiados.current = [t, ...copiados.current].slice(0, 30);
    };
    const onPantalla = () => {
      if (!estado.sinSeb) return;
      const fuera = !document.fullscreenElement;
      setFueraDePantallaCompleta(fuera);
      if (fuera) registrar("pantalla_completa_salida", {});
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", volver);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("copy", onCopia);
    document.addEventListener("cut", onCopia);
    document.addEventListener("fullscreenchange", onPantalla);
    if (estado.sinSeb && !document.fullscreenElement) setFueraDePantallaCompleta(true);
    const antesDeSalir = () => {
      if (cola.current.length) api("/api/alumno/eventos", { cuerpo: { eventos: cola.current.splice(0, 100) }, keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", antesDeSalir);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", volver);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("copy", onCopia);
      document.removeEventListener("cut", onCopia);
      document.removeEventListener("fullscreenchange", onPantalla);
      window.removeEventListener("pagehide", antesDeSalir);
    };
  }, [estado.sinSeb, registrar, enviarEventos]);

  const alPegar = (consignaId: string, p: InfoPegado) => {
    const t = normalizar(p.texto);
    const interno = !!t && copiados.current.some((c) => c === t || c.includes(t));
    if (interno) m(consignaId).pegadoInterno += p.caracteres;
    else m(consignaId).pegadoExterno += p.caracteres;
    registrar("pegado", { caracteres: p.caracteres, origen: interno ? "interno" : "externo", muestra: p.texto.slice(0, 500) }, consignaId);
  };

  /** Guarda todo lo pendiente, esperando si hay un autoguardado en curso. */
  async function guardarTodo(): Promise<boolean> {
    for (let intento = 0; intento < 10; intento++) {
      while (guardando.current) await new Promise((r) => setTimeout(r, 150));
      await guardar();
      if (!sucias.current.size) return true;
      await new Promise((r) => setTimeout(r, 800));
    }
    return false;
  }

  async function entregar() {
    setEntregando(true);
    setErrorEntrega("");
    try {
      if (!(await guardarTodo())) throw new Error("No se pudieron guardar todas las respuestas. Revisá la conexión y reintentá.");
      await enviarEventos();
      terminado.current = true;
      await api("/api/alumno/entregar", { cuerpo: { confirmar: true } });
      onTerminado();
    } catch (e) {
      terminado.current = false;
      setErrorEntrega(e instanceof Error ? e.message : "Error al entregar");
      setEntregando(false);
    }
  }

  const hh = Math.floor(restante / 3600);
  const mm = Math.floor((restante % 3600) / 60);
  const ss = restante % 60;
  const reloj = `${hh > 0 ? `${String(hh).padStart(2, "0")}:` : ""}${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const poco = restante <= 300;

  return (
    <div className="examen">
      <header className="examen-barra">
        <span><strong>{estado.alumno.nombre}</strong> · LU {estado.alumno.lu}</span>
        <span className="sutil">{estado.examen.materia} — Tema {estado.tema.numero}</span>
        <span className={`guardado ${estadoGuardado.error ? "error" : ""}`} aria-live="polite">{estadoGuardado.texto}</span>
        <span className={`reloj ${poco ? "poco" : ""}`} aria-label="Tiempo restante">⏱ {reloj}</span>
        <button onClick={() => setConfirmarEntrega(true)} disabled={entregando || restante === 0}>Entregar</button>
      </header>
      {poco && restante > 0 && <div className="aviso">Quedan menos de 5 minutos. Al terminar el tiempo, el examen se entrega automáticamente.</div>}
      {restante === 0 && <div className="aviso">Tiempo terminado. Entregando tu examen…</div>}
      <div className="examen-cuerpo">
        <section className="caso" aria-label="Caso">
          <h2>Caso: {estado.tema.titulo}</h2>
          <div className="html" dangerouslySetInnerHTML={{ __html: estado.tema.casoHtml }} />
        </section>
        <section className="consignas" aria-label="Consignas">
          {estado.consignas.map((c, i) => (
            <article key={c.id} className="consigna">
              <h3>Consigna {i + 1}{c.parte ? ` (${c.parte})` : ""} — {c.titulo} <span className="puntaje">{c.puntaje} pts</span></h3>
              <div className="html enunciado" dangerouslySetInnerHTML={{ __html: c.enunciadoHtml }} />
              <Editor
                etiqueta={`Respuesta a la consigna ${i + 1}`}
                valorInicial={estado.respuestas[c.id] ?? ""}
                deshabilitado={restante === 0 || entregando}
                onCambio={(html) => {
                  respuestas.current[c.id] = html;
                  sucias.current.add(c.id);
                  setEstadoGuardado({ texto: "Guardando…" });
                }}
                onTecla={() => m(c.id).teclas++}
                onPegado={(p) => alPegar(c.id, p)}
              />
            </article>
          ))}
        </section>
      </div>
      <Modal
        abierto={confirmarEntrega}
        titulo="¿Entregar el examen?"
        onCerrar={entregando ? undefined : () => setConfirmarEntrega(false)}
        acciones={
          <>
            <button className="secundario" onClick={() => setConfirmarEntrega(false)} disabled={entregando}>Seguir editando</button>
            <button onClick={entregar} disabled={entregando}>{entregando ? "Entregando…" : "Entregar definitivamente"}</button>
          </>
        }
      >
        <p>La entrega es <strong>definitiva</strong>: después no vas a poder modificar tus respuestas.</p>
        {errorEntrega && <p className="error" role="alert">{errorEntrega}</p>}
      </Modal>
      {fueraDePantallaCompleta && (
        <div className="modal-fondo">
          <div className="modal">
            <h2>Volvé a pantalla completa</h2>
            <p>El examen se rinde en pantalla completa. La salida quedó registrada.</p>
            <div className="modal-acciones">
              <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Volver a pantalla completa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Entregado({ estado }: { estado: Extract<Estado, { estado: "entregado" }> }) {
  return (
    <div className="centro">
      <div className="tarjeta">
        <h1>✓ Entrega recibida</h1>
        <p><strong>{estado.alumno.nombre}</strong> · LU {estado.alumno.lu}</p>
        <p>{estado.examen.materia} — {estado.examen.instancia}</p>
        <p>Entregado el <strong>{fechaHora(estado.entrega.entregadoEn)}</strong>.</p>
        <p className="sutil">Código de verificación:<br /><code className="codigo">{estado.entrega.codigo}</code></p>
        <a className="boton" href="/api/alumno/pdf" download>Descargar PDF</a>
        <p className="sutil">También te enviamos el PDF por mail. El docente revisará tu examen para definir la nota final.</p>
      </div>
    </div>
  );
}
