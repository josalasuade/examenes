"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Editor } from "../Editor";
import { Modal } from "../Modal";
import { apiAdmin, EstadoAsignacion, EstadoExamen, fechaHora, hora, leerArchivo, useAviso, useConfirmar } from "./comun";

type Criterio = { descripcion: string; puntaje: number; completo: string; parcial: string; ausente: string };
type Consigna = { id?: string; titulo: string; parte: string | null; puntaje: number; enunciadoHtml: string; noSuma: string; criterios: Criterio[] };
type Tema = { id: string; numero: number; titulo: string; casoHtml: string; consignas: Consigna[] };
type Banda = { desde: number; nota: string };
type Examen = {
  id: string; materia: string; docente: string; instancia: string; departamento: string; fecha: string; duracion_min: number;
  consignas_generales: string; condiciones_aprobacion: string; escala: Banda[]; codigo_ingreso: string; ingreso_hasta: string | null;
  estado: string; requiere_seb: boolean; seb_config_key: string; temas: Tema[];
};

const PESTANAS = ["Datos", "Temas", "Alumnos", "En vivo", "Resultados"] as const;
type Pestana = (typeof PESTANAS)[number];

export function AdminExamen() {
  const { id } = useParams<{ id: string }>();
  const [examen, setExamen] = useState<Examen | null>(null);
  const [pestana, setPestana] = useState<Pestana>("Datos");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setExamen(await apiAdmin<Examen>(`/api/admin/examenes/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [id]);
  useEffect(() => {
    cargar();
    try {
      const p = sessionStorage.getItem(`pestana-${id}`);
      if (p && (PESTANAS as readonly string[]).includes(p)) setPestana(p as Pestana);
    } catch {}
  }, [cargar, id]);

  const elegir = (p: Pestana) => {
    setPestana(p);
    try {
      sessionStorage.setItem(`pestana-${id}`, p);
    } catch {}
  };

  if (error) return <div className="panel"><p className="error">{error}</p><a href="/admin">← Volver</a></div>;
  if (!examen) return <div className="panel"><p>Cargando…</p></div>;

  return (
    <div className="panel">
      <div className="panel-cabecera">
        <a href="/admin">← Exámenes</a>
        <h1>{examen.materia} — {examen.instancia}</h1>
        <EstadoExamen estado={examen.estado} />
      </div>
      <nav className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p} role="tab" aria-selected={pestana === p} className={pestana === p ? "activa" : ""} onClick={() => elegir(p)}>{p}</button>
        ))}
      </nav>
      {pestana === "Datos" && <Datos examen={examen} onCambio={cargar} />}
      {pestana === "Temas" && <Temas examen={examen} onCambio={cargar} />}
      {pestana === "Alumnos" && <Alumnos examen={examen} />}
      {pestana === "En vivo" && <EnVivo examen={examen} onCambio={cargar} />}
      {pestana === "Resultados" && <Resultados examen={examen} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datos generales y ciclo de vida

function Datos({ examen, onCambio }: { examen: Examen; onCambio: () => void }) {
  const [f, setF] = useState({
    materia: examen.materia, docente: examen.docente, instancia: examen.instancia, departamento: examen.departamento,
    fecha: examen.fecha, duracionMin: examen.duracion_min, consignasGenerales: examen.consignas_generales,
    condicionesAprobacion: examen.condiciones_aprobacion, escala: examen.escala, codigoIngreso: examen.codigo_ingreso,
    requiereSeb: examen.requiere_seb, sebConfigKey: examen.seb_config_key,
  });
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const borrador = examen.estado === "borrador";
  const cerrado = examen.estado === "cerrado";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: k === "duracionMin" ? Number(e.target.value) : e.target.value });

  async function guardar() {
    try {
      await apiAdmin(`/api/admin/examenes/${examen.id}`, { metodo: "PUT", cuerpo: f });
      aviso.mostrar("Guardado.");
      onCambio();
    } catch (e) {
      aviso.mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }
  const accion = (accion: string) => async () => {
    const r = await apiAdmin<{ avisos?: string[] }>(`/api/admin/examenes/${examen.id}/accion`, { cuerpo: { accion } });
    aviso.mostrar(r.avisos?.length ? `Hecho. Atención: ${r.avisos.join(" ")}` : "Hecho.", !!r.avisos?.length);
    onCambio();
  };

  return (
    <>
      {aviso.nodo}
      <div className="caja">
        <h2>Datos del examen</h2>
        {!borrador && <p className="sutil">El examen está {examen.estado}: solo se pueden cambiar el código de ingreso y la configuración de SEB.</p>}
        <fieldset disabled={!borrador} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="fila">
            <label>Materia<input value={f.materia} onChange={set("materia")} /></label>
            <label>Docente<input value={f.docente} onChange={set("docente")} /></label>
          </div>
          <div className="fila">
            <label>Instancia<input value={f.instancia} onChange={set("instancia")} /></label>
            <label>Fecha<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
            <label>Duración (minutos)<input type="number" min={1} max={600} value={f.duracionMin} onChange={set("duracionMin")} /></label>
          </div>
          <label>Departamento (encabezado del PDF)<input value={f.departamento} onChange={set("departamento")} /></label>
          <label>Consignas generales<textarea rows={8} value={f.consignasGenerales} onChange={set("consignasGenerales")} /></label>
          <label>Condiciones de aprobación<input value={f.condicionesAprobacion} onChange={set("condicionesAprobacion")} /></label>
          <div>
            <strong style={{ fontSize: "0.9rem" }}>Escala de notas (puntaje desde → nota)</strong>
            <div className="fila" style={{ marginTop: 6 }}>
              {f.escala.map((b, i) => (
                <div key={i} style={{ flex: "0 1 110px" }}>
                  <input aria-label={`Desde, banda ${i + 1}`} type="number" value={b.desde}
                    onChange={(e) => setF({ ...f, escala: f.escala.map((x, j) => (j === i ? { ...x, desde: Number(e.target.value) } : x)) })} />
                  <input aria-label={`Nota, banda ${i + 1}`} value={b.nota}
                    onChange={(e) => setF({ ...f, escala: f.escala.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)) })} />
                </div>
              ))}
            </div>
          </div>
        </fieldset>
        <h3 style={{ marginTop: 16 }}>Ingreso y Safe Exam Browser</h3>
        <fieldset disabled={cerrado} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="fila">
            <label>Código de ingreso (se dicta en el aula)<input value={f.codigoIngreso} onChange={(e) => setF({ ...f, codigoIngreso: e.target.value.toUpperCase() })} maxLength={50} /></label>
            <label>Config Key del archivo .seb (64 caracteres)<input className="mono" value={f.sebConfigKey} onChange={set("sebConfigKey")} maxLength={64} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.requiereSeb} onChange={(e) => setF({ ...f, requiereSeb: e.target.checked })} /> Requiere Safe Exam Browser (se puede exceptuar alumno por alumno)</label>
          <button onClick={guardar}>Guardar</button>
        </fieldset>
      </div>
      <div className="caja">
        <h2>Estado</h2>
        <div className="acciones">
          {borrador && (
            <button onClick={() => confirmar.pedir({
              titulo: "Publicar examen",
              mensaje: <p>Al publicar se congela el contenido (temas, consignas, rúbricas) y los alumnos podrán ingresar cuando abras la ventana de ingreso. Guardá los cambios antes de publicar.</p>,
              boton: "Publicar", accion: accion("publicar"),
            })}>Publicar</button>
          )}
          {examen.estado === "publicado" && (
            <>
              <button className="secundario" onClick={() => confirmar.pedir({
                titulo: "Volver a borrador", mensaje: <p>Solo es posible si ningún alumno empezó.</p>, boton: "Volver a borrador", accion: accion("volver_borrador"),
              })}>Volver a borrador</button>
              <button className="peligro" onClick={() => confirmar.pedir({
                titulo: "Cerrar examen", peligro: true,
                mensaje: <p>Se entregan automáticamente todos los exámenes en curso y nadie más podrá ingresar. No se puede deshacer.</p>,
                boton: "Cerrar examen", accion: accion("cerrar"),
              })}>Cerrar examen</button>
            </>
          )}
          {borrador && (
            <button className="peligro" onClick={() => confirmar.pedir({
              titulo: "Borrar examen", peligro: true, mensaje: <p>Se borra el examen con sus temas y asignaciones. No se puede deshacer.</p>, boton: "Borrar",
              accion: async () => {
                await apiAdmin(`/api/admin/examenes/${examen.id}`, { metodo: "DELETE", cuerpo: {} });
                location.href = "/admin";
              },
            })}>Borrar examen</button>
          )}
        </div>
      </div>
      {confirmar.nodo}
    </>
  );
}

// ---------------------------------------------------------------------------
// Temas: importación y edición

function Temas({ examen, onCambio }: { examen: Examen; onCambio: () => void }) {
  const [markdown, setMarkdown] = useState("");
  const aviso = useAviso();
  const borrador = examen.estado === "borrador";

  async function importar() {
    try {
      const r = await apiAdmin<{ temas: { numero: number; titulo: string; consignas: number }[] }>(`/api/admin/examenes/${examen.id}/importar`, { cuerpo: { markdown } });
      aviso.mostrar(`Importado: ${r.temas.map((t) => `Tema ${t.numero} (${t.consignas} consignas)`).join(", ")}.`);
      setMarkdown("");
      onCambio();
    } catch (e) {
      aviso.mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }

  return (
    <>
      {aviso.nodo}
      {borrador && (
        <div className="caja">
          <h2>Importar temas desde Markdown</h2>
          <p className="sutil">Formato: ver <code>docs/FORMATO_IMPORTACION.md</code>. Los temas con el mismo número se reemplazan.</p>
          <input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setMarkdown(await leerArchivo(f));
          }} />
          <textarea rows={8} value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder="# Tema 1: Título&#10;## Caso&#10;…" style={{ marginTop: 8 }} className="mono" />
          <div className="acciones" style={{ marginTop: 8 }}>
            <button onClick={importar} disabled={!markdown.trim()}>Importar</button>
            <button className="secundario" onClick={async () => {
              await apiAdmin(`/api/admin/examenes/${examen.id}/temas`, { cuerpo: {} });
              onCambio();
            }}>+ Tema vacío</button>
          </div>
        </div>
      )}
      {examen.temas.length === 0 && <div className="caja"><p>Sin temas todavía.</p></div>}
      {examen.temas.map((t) => <EditorTema key={`${t.id}-${t.consignas.length}-${t.titulo}`} tema={t} editable={borrador} onCambio={onCambio} />)}
    </>
  );
}

const CONSIGNA_VACIA: Consigna = { titulo: "", parte: null, puntaje: 25, enunciadoHtml: "", noSuma: "", criterios: [] };

function EditorTema({ tema, editable, onCambio }: { tema: Tema; editable: boolean; onCambio: () => void }) {
  const [t, setT] = useState(tema);
  const [abierto, setAbierto] = useState(false);
  const [version, setVersion] = useState(0);
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const total = t.consignas.reduce((a, c) => a + Number(c.puntaje || 0), 0);
  const setC = (i: number, c: Partial<Consigna>) => setT({ ...t, consignas: t.consignas.map((x, j) => (j === i ? { ...x, ...c } : x)) });

  async function guardar() {
    try {
      await apiAdmin(`/api/admin/temas/${t.id}`, { metodo: "PUT", cuerpo: t });
      aviso.mostrar("Tema guardado.");
      onCambio();
    } catch (e) {
      aviso.mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }

  return (
    <div className="caja">
      <div className="acciones">
        <h2 style={{ margin: 0, flex: 1 }}>Tema {t.numero}: {t.titulo}</h2>
        <span className="sutil">{t.consignas.length} consignas · {total} puntos{t.consignas.some((c) => c.parte) ? " (sumando todas las partes)" : ""}</span>
        <button className="secundario chico" onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar" : editable ? "Editar" : "Ver"}</button>
      </div>
      {aviso.nodo}
      {abierto && (
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
          <label>Título del tema / caso<input value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} /></label>
          <strong style={{ fontSize: "0.9rem" }}>Caso</strong>
          <Editor key={`caso-${version}`} etiqueta="Caso" valorInicial={t.casoHtml} deshabilitado={!editable} onCambio={(html) => setT((x) => ({ ...x, casoHtml: html }))} />
          {t.consignas.map((c, i) => (
            <div key={`${i}-${version}`} className="caja" style={{ marginTop: 14, background: "#fafbfc" }}>
              <div className="acciones">
                <h3 style={{ margin: 0, flex: 1 }}>Consigna {i + 1}</h3>
                {editable && (
                  <>
                    <button className="secundario chico" disabled={i === 0} onClick={() => {
                      const cs = [...t.consignas];
                      [cs[i - 1], cs[i]] = [cs[i], cs[i - 1]];
                      setT({ ...t, consignas: cs });
                      setVersion((v) => v + 1);
                    }}>↑</button>
                    <button className="peligro chico" onClick={() => {
                      setT({ ...t, consignas: t.consignas.filter((_, j) => j !== i) });
                      setVersion((v) => v + 1);
                    }}>Quitar</button>
                  </>
                )}
              </div>
              <div className="fila">
                <label style={{ flex: "3 1 300px" }}>Título<input value={c.titulo} onChange={(e) => setC(i, { titulo: e.target.value })} /></label>
                <label style={{ flex: "1 1 80px" }}>Parte (opcional)<input value={c.parte ?? ""} maxLength={10} onChange={(e) => setC(i, { parte: e.target.value.toUpperCase() || null })} /></label>
                <label style={{ flex: "1 1 80px" }}>Puntaje<input type="number" min={0} max={100} value={c.puntaje} onChange={(e) => setC(i, { puntaje: Number(e.target.value) })} /></label>
              </div>
              <strong style={{ fontSize: "0.9rem" }}>Enunciado</strong>
              <Editor etiqueta={`Enunciado consigna ${i + 1}`} valorInicial={c.enunciadoHtml} deshabilitado={!editable}
                onCambio={(html) => setT((x) => ({ ...x, consignas: x.consignas.map((y, j) => (j === i ? { ...y, enunciadoHtml: html } : y)) }))} />
              <details style={{ marginTop: 10 }} open={c.criterios.length > 0}>
                <summary><strong>Rúbrica</strong> ({c.criterios.length} criterios, suma {c.criterios.reduce((a, r) => a + Number(r.puntaje || 0), 0)} de {c.puntaje})</summary>
                {c.criterios.map((r, k) => (
                  <div key={k} className="criterio">
                    <label>Puntos<input type="number" min={0} value={r.puntaje} onChange={(e) => setC(i, { criterios: c.criterios.map((x, j) => (j === k ? { ...x, puntaje: Number(e.target.value) } : x)) })} /></label>
                    <div>
                      <label>Criterio<input value={r.descripcion} onChange={(e) => setC(i, { criterios: c.criterios.map((x, j) => (j === k ? { ...x, descripcion: e.target.value } : x)) })} /></label>
                      <div className="fila">
                        {(["completo", "parcial", "ausente"] as const).map((n) => (
                          <label key={n} style={{ textTransform: "capitalize" }}>{n}<input value={r[n]} onChange={(e) => setC(i, { criterios: c.criterios.map((x, j) => (j === k ? { ...x, [n]: e.target.value } : x)) })} /></label>
                        ))}
                      </div>
                      {editable && <button className="secundario chico" onClick={() => setC(i, { criterios: c.criterios.filter((_, j) => j !== k) })}>Quitar criterio</button>}
                    </div>
                  </div>
                ))}
                {editable && <button className="secundario chico" style={{ marginTop: 8 }} onClick={() => setC(i, { criterios: [...c.criterios, { descripcion: "", puntaje: 0, completo: "", parcial: "", ausente: "" }] })}>+ Criterio</button>}
                <label style={{ marginTop: 10 }}>No suma puntos (uno por línea)<textarea rows={3} value={c.noSuma} onChange={(e) => setC(i, { noSuma: e.target.value })} /></label>
              </details>
            </div>
          ))}
          {editable && (
            <div className="acciones" style={{ marginTop: 12 }}>
              <button className="secundario" onClick={() => setT({ ...t, consignas: [...t.consignas, { ...CONSIGNA_VACIA }] })}>+ Consigna</button>
              <button onClick={guardar}>Guardar tema</button>
              <button className="peligro" onClick={() => confirmar.pedir({
                titulo: `Borrar tema ${t.numero}`, peligro: true, mensaje: <p>Se borra el tema con sus consignas.</p>, boton: "Borrar",
                accion: async () => {
                  await apiAdmin(`/api/admin/temas/${t.id}`, { metodo: "DELETE", cuerpo: {} });
                  onCambio();
                },
              })}>Borrar tema</button>
            </div>
          )}
        </fieldset>
      )}
      {confirmar.nodo}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alumnos

type FilaAlumno = {
  id: string; lu: string; nombre: string; mail: string; tema: number; parte: string | null; sin_seb: boolean; carrera: string | null;
  estado: string; entregado_en: string | null; nota_final: number | null; mail_estado: string | null; mail_error: string | null;
};

function Alumnos({ examen }: { examen: Examen }) {
  const [filas, setFilas] = useState<FilaAlumno[]>([]);
  const [csv, setCsv] = useState("");
  const [editando, setEditando] = useState<FilaAlumno | null>(null);
  const aviso = useAviso();
  const { mostrar } = aviso;
  const confirmar = useConfirmar();
  const cargar = useCallback(() => {
    apiAdmin<FilaAlumno[]>(`/api/admin/examenes/${examen.id}/alumnos`).then(setFilas).catch((e) => mostrar(e.message, true));
  }, [examen.id, mostrar]);
  useEffect(cargar, [cargar]);

  async function importar() {
    try {
      const r = await apiAdmin<{ nuevos: number; actualizados: number; sinCambiosPorIniciados: number }>(`/api/admin/examenes/${examen.id}/alumnos`, { cuerpo: { csv } });
      mostrar(`Importado: ${r.nuevos} nuevos, ${r.actualizados} actualizados${r.sinCambiosPorIniciados ? `, ${r.sinCambiosPorIniciados} sin cambios (ya empezaron)` : ""}.`);
      setCsv("");
      cargar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }

  return (
    <>
      {aviso.nodo}
      {examen.estado !== "cerrado" && (
        <div className="caja">
          <h2>Importar alumnos (CSV)</h2>
          <p className="sutil">Columnas: <code>lu, nombre, mail, tema, parte, sin_seb</code> (parte y sin_seb son opcionales; separador coma o punto y coma). Si el LU ya existe, se actualiza.</p>
          <input type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await leerArchivo(f));
          }} />
          <textarea rows={5} className="mono" style={{ marginTop: 8 }} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"lu;nombre;mail;tema;parte;sin_seb\n1234567;Apellido, Nombre;alumno@uade.edu.ar;1;A;no"} />
          <button style={{ marginTop: 8 }} onClick={importar} disabled={!csv.trim() || examen.temas.length === 0}>Importar</button>
          {examen.temas.length === 0 && <p className="sutil">Primero cargá los temas.</p>}
        </div>
      )}
      <table className="tabla tabla-cards">
        <thead><tr><th>LU</th><th>Nombre</th><th>Mail</th><th>Tema</th><th>Parte</th><th>SEB</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td data-label="LU">{f.lu}</td>
              <td data-label="Nombre">{f.nombre}</td>
              <td data-label="Mail">{f.mail}</td>
              <td data-label="Tema">{f.tema}</td>
              <td data-label="Parte">{f.parte ?? "—"}</td>
              <td data-label="SEB">{f.sin_seb ? <span className="etiqueta amarilla">Sin SEB</span> : examen.requiere_seb ? "Requerido" : "No"}</td>
              <td data-label="Estado"><EstadoAsignacion estado={f.estado} /></td>
              <td>
                <div className="acciones">
                  <button className="secundario chico" onClick={() => setEditando(f)}>Editar</button>
                  {f.estado === "pendiente" && (
                    <button className="peligro chico" onClick={() => confirmar.pedir({
                      titulo: "Quitar alumno", peligro: true, mensaje: <p>Se quita a {f.nombre} de este examen.</p>, boton: "Quitar",
                      accion: async () => {
                        await apiAdmin(`/api/admin/asignaciones/${f.id}`, { metodo: "DELETE", cuerpo: {} });
                        cargar();
                      },
                    })}>Quitar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length === 0 && <p className="sutil">No hay alumnos cargados.</p>}
      {editando && <EditarAlumno fila={editando} temas={examen.temas.map((t) => t.numero)} onCerrar={() => { setEditando(null); cargar(); }} />}
      {confirmar.nodo}
    </>
  );
}

function EditarAlumno({ fila, temas, onCerrar }: { fila: FilaAlumno; temas: number[]; onCerrar: () => void }) {
  const [f, setF] = useState({ nombre: fila.nombre, mail: fila.mail, tema: fila.tema, parte: fila.parte ?? "", sinSeb: fila.sin_seb });
  const [error, setError] = useState("");
  const pendiente = fila.estado === "pendiente";
  return (
    <Modal abierto titulo={`Editar ${fila.lu}`} onCerrar={onCerrar} acciones={
      <>
        <button className="secundario" onClick={onCerrar}>Cancelar</button>
        <button onClick={async () => {
          setError("");
          try {
            const cuerpo: Record<string, unknown> = { nombre: f.nombre, mail: f.mail, sinSeb: f.sinSeb };
            if (pendiente) Object.assign(cuerpo, { tema: f.tema, parte: f.parte });
            await apiAdmin(`/api/admin/asignaciones/${fila.id}`, { metodo: "PUT", cuerpo });
            onCerrar();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
          }
        }}>Guardar</button>
      </>
    }>
      <label>Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
      <label>Mail<input type="email" value={f.mail} onChange={(e) => setF({ ...f, mail: e.target.value })} /></label>
      <div className="fila">
        <label>Tema
          <select value={f.tema} disabled={!pendiente} onChange={(e) => setF({ ...f, tema: Number(e.target.value) })}>
            {temas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Parte<input value={f.parte} disabled={!pendiente} maxLength={10} onChange={(e) => setF({ ...f, parte: e.target.value.toUpperCase() })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.sinSeb} onChange={(e) => setF({ ...f, sinSeb: e.target.checked })} /> Habilitado a rendir sin Safe Exam Browser (pantalla completa obligatoria)</label>
      {!pendiente && <p className="sutil">El alumno ya empezó: no se puede cambiar el tema ni la parte.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// En vivo

type FilaVivo = {
  id: string; lu: string; nombre: string; tema: number; parte: string | null; sin_seb: boolean; estado: string;
  iniciado_en: string | null; vence_en: string | null; entregado_en: string | null; entrega_tipo: string | null; sesion_activa: boolean;
  pegados_externos: number; caracteres_pegados: number; salidas: number; segundos_fuera: number; salidas_cortas: number;
  inserciones: number; salidas_pantalla: number; ingresos: number; mail_estado: string | null;
};
type Vivo = {
  examen: { estado: string; ingreso_hasta: string | null; codigo_ingreso: string };
  servidorAhora: string;
  alumnos: FilaVivo[];
  reingresos: { id: string; creada_en: string; nombre: string; lu: string; estado: string }[];
};

function mmss(seg: number) {
  const s = Math.max(0, Math.floor(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function EnVivo({ examen, onCambio }: { examen: Examen; onCambio: () => void }) {
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [minutos, setMinutos] = useState(10);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [desfase, setDesfase] = useState(0);
  const aviso = useAviso();
  const { mostrar } = aviso;
  const confirmar = useConfirmar();

  const cargar = useCallback(async () => {
    try {
      const v = await apiAdmin<Vivo>(`/api/admin/examenes/${examen.id}/envivo`);
      setDesfase(new Date(v.servidorAhora).getTime() - Date.now());
      setVivo(v);
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }, [examen.id, mostrar]);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5000);
    const r = setInterval(() => setAhora(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [cargar]);

  const accionExamen = async (accion: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiAdmin(`/api/admin/examenes/${examen.id}/accion`, { cuerpo: { accion, ...extra } });
      cargar();
      onCambio();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  };
  const resolverReingreso = async (id: string, aprobar: boolean) => {
    try {
      await apiAdmin(`/api/admin/reingresos/${id}`, { cuerpo: { aprobar } });
      cargar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  };
  const accionAlumno = (id: string, accion: string) => async () => {
    await apiAdmin(`/api/admin/asignaciones/${id}/accion`, { cuerpo: { accion } });
    cargar();
  };

  if (!vivo) return <p>Cargando…</p>;
  const ahoraSrv = ahora + desfase;
  const ingresoRestante = vivo.examen.ingreso_hasta ? (new Date(vivo.examen.ingreso_hasta).getTime() - ahoraSrv) / 1000 : 0;
  const cuenta = (e: string) => vivo.alumnos.filter((a) => a.estado === e).length;

  return (
    <>
      {aviso.nodo}
      {vivo.examen.estado !== "publicado" && <div className="alerta">El examen está {vivo.examen.estado}. Publicalo para que los alumnos puedan ingresar.</div>}
      <div className="caja">
        <div className="fila" style={{ alignItems: "center" }}>
          <div>
            <div className="sutil">Código de ingreso</div>
            <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: 2 }} className="mono">{vivo.examen.codigo_ingreso || "—"}</div>
          </div>
          <div>
            <div className="sutil">Ventana de ingreso</div>
            {ingresoRestante > 0 ? <strong className="ok">Abierta · cierra en {mmss(ingresoRestante)}</strong> : <strong>Cerrada</strong>}
            <div className="acciones" style={{ marginTop: 6 }}>
              <input type="number" min={1} max={240} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} style={{ width: 80 }} aria-label="Minutos" />
              <button onClick={() => accionExamen("abrir_ingreso", { minutos })} disabled={vivo.examen.estado !== "publicado"}>{ingresoRestante > 0 ? "Reabrir" : "Abrir"} por {minutos} min</button>
              {ingresoRestante > 0 && <button className="secundario" onClick={() => accionExamen("cerrar_ingreso")}>Cerrar ahora</button>}
            </div>
          </div>
          <div>
            <div className="sutil">Alumnos</div>
            <strong>{cuenta("pendiente")}</strong> sin empezar · <strong>{cuenta("en_curso")}</strong> rindiendo · <strong>{cuenta("entregado")}</strong> entregaron
          </div>
        </div>
      </div>
      {vivo.reingresos.length > 0 && (
        <div className="alerta" role="alert">
          <strong>Solicitudes de reingreso</strong>
          {vivo.reingresos.map((r) => (
            <div key={r.id} className="acciones" style={{ marginTop: 6 }}>
              <span style={{ flex: 1 }}>{r.nombre} (LU {r.lu}) — pedido a las {hora(r.creada_en)}</span>
              <button className="chico" onClick={() => resolverReingreso(r.id, true)}>Aprobar</button>
              <button className="peligro chico" onClick={() => resolverReingreso(r.id, false)}>Rechazar</button>
            </div>
          ))}
          <p className="sutil" style={{ margin: "6px 0 0" }}>Aprobar cierra la sesión anterior del alumno. Si alguien entró con el LU de otro, rechazá y usá “Reiniciar” sobre ese alumno.</p>
        </div>
      )}
      <table className="tabla tabla-cards">
        <thead>
          <tr><th>Alumno</th><th>Tema</th><th>Estado</th><th>Tiempo</th><th>Pegados externos</th><th>Salidas (&gt;2s)</th><th>Otros</th><th></th></tr>
        </thead>
        <tbody>
          {vivo.alumnos.map((a) => {
            const resta = a.vence_en ? (new Date(a.vence_en).getTime() - ahoraSrv) / 1000 : 0;
            return (
              <tr key={a.id}>
                <td data-label="Alumno">{a.nombre}<div className="sutil">LU {a.lu}{a.sin_seb ? " · sin SEB" : ""}</div></td>
                <td data-label="Tema">{a.tema}{a.parte ? ` (${a.parte})` : ""}</td>
                <td data-label="Estado">
                  <EstadoAsignacion estado={a.estado} />
                  {a.estado === "en_curso" && !a.sesion_activa && <div><span className="etiqueta roja">Sin sesión</span></div>}
                </td>
                <td data-label="Tiempo">
                  {a.estado === "en_curso" ? <>Queda <strong>{mmss(resta)}</strong></> : a.estado === "entregado" ? <>{hora(a.entregado_en)}<div className="sutil">{a.entrega_tipo === "alumno" ? "por el alumno" : a.entrega_tipo === "vencimiento" ? "por tiempo" : "por el docente"}</div></> : "—"}
                </td>
                <td data-label="Pegados externos">{a.pegados_externos ? <span className="etiqueta roja">{a.pegados_externos} ({a.caracteres_pegados} car.)</span> : "0"}</td>
                <td data-label="Salidas">{a.salidas ? <span className="etiqueta roja">{a.salidas} ({mmss(a.segundos_fuera)})</span> : "0"}{a.salidas_cortas ? <div className="sutil">{a.salidas_cortas} cortas</div> : null}</td>
                <td data-label="Otros">
                  {a.inserciones > 0 && <div><span className="etiqueta amarilla">{a.inserciones} inserciones sin tecleo</span></div>}
                  {a.salidas_pantalla > 0 && <div><span className="etiqueta amarilla">{a.salidas_pantalla} salidas de pantalla completa</span></div>}
                  {a.ingresos > 1 && <div className="sutil">{a.ingresos} ingresos</div>}
                </td>
                <td>
                  <div className="acciones">
                    <button className="secundario chico" onClick={() => setDetalle(a.id)}>Detalle</button>
                    {a.estado === "en_curso" && (
                      <button className="chico" onClick={() => confirmar.pedir({
                        titulo: `Entregar examen de ${a.nombre}`, mensaje: <p>Se entrega con lo último guardado. El alumno no podrá seguir editando.</p>,
                        boton: "Entregar", accion: accionAlumno(a.id, "forzar_entrega"),
                      })}>Entregar</button>
                    )}
                    {a.estado !== "entregado" && a.sesion_activa && (
                      <button className="secundario chico" onClick={() => confirmar.pedir({
                        titulo: `Cerrar sesión de ${a.nombre}`, mensaje: <p>El alumno tendrá que volver a ingresar y vos aprobar el reingreso. El tiempo sigue corriendo.</p>,
                        boton: "Cerrar sesión", accion: accionAlumno(a.id, "revocar_sesion"),
                      })}>Cerrar sesión</button>
                    )}
                    {a.estado !== "entregado" && a.ingresos > 0 && (
                      <button className="peligro chico" onClick={() => confirmar.pedir({
                        titulo: `Reiniciar examen de ${a.nombre}`, peligro: true,
                        mensaje: <p>Borra sus respuestas y su tiempo, y lo deja como si no hubiera empezado. Usalo si alguien ingresó con el LU de este alumno. Para que el alumno vuelva a entrar, abrí la ventana de ingreso.</p>,
                        boton: "Reiniciar", accion: accionAlumno(a.id, "reiniciar"),
                      })}>Reiniciar</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {detalle && <DetalleAlumno id={detalle} onCerrar={() => setDetalle(null)} />}
      {confirmar.nodo}
    </>
  );
}

// ---------------------------------------------------------------------------
// Detalle de un alumno: respuestas + registro de eventos

type Detalle = {
  id: string; lu: string; nombre: string; mail: string; carrera: string | null; tema: number; tema_titulo: string; parte: string | null; estado: string;
  iniciado_en: string | null; vence_en: string | null; entregado_en: string | null; entrega_tipo: string | null; codigo: string | null;
  nota_final: number | null; observaciones: string; mail_estado: string | null; mail_error: string | null;
  consignas: { id: string; orden: number; titulo: string; parte: string | null; puntaje: number; html: string; actualizadoEn: string | null }[];
  eventos: { id: number; tipo: string; detalle: Record<string, unknown>; cliente_ts: string | null; creado_en: string; consigna_orden: number | null }[];
};

const NOMBRE_EVENTO: Record<string, string> = {
  ingreso: "Ingresó", reingreso_solicitado: "Pidió reingreso", reingreso: "Reingresó", inicio: "Comenzó el examen",
  pegado: "Pegó texto", salida: "Salió de la ventana", pantalla_completa_salida: "Salió de pantalla completa",
  insercion_sin_tecleo: "Inserción sin tecleo", entrega: "Entregó",
  docente_aprobo_reingreso: "Docente aprobó reingreso", docente_rechazo_reingreso: "Docente rechazó reingreso",
  docente_revoco_sesion: "Docente cerró la sesión", docente_reinicio: "Docente reinició el examen", docente_sin_seb: "Docente cambió excepción de SEB",
};

function describirEvento(e: Detalle["eventos"][number]): string {
  const d = e.detalle ?? {};
  const consigna = e.consigna_orden ? ` en consigna ${e.consigna_orden}` : "";
  switch (e.tipo) {
    case "pegado": return `${d.caracteres} caracteres${consigna} — origen ${d.origen === "interno" ? "interno (copiado del propio examen)" : "EXTERNO"}`;
    case "salida": return `${Math.round(Number(d.duracionMs) / 1000)} s fuera (${d.motivo === "pestaña_oculta" ? "pestaña oculta / minimizado" : "perdió el foco"})`;
    case "insercion_sin_tecleo": return `+${d.caracteres} caracteres${consigna} sin tecleo ni pegado suficiente (teclas: ${d.teclas}, pegado: ${Number(d.pegadoExterno) + Number(d.pegadoInterno)})`;
    case "entrega": return d.tipo === "alumno" ? "por el alumno" : d.tipo === "vencimiento" ? "automática por tiempo" : "por el docente";
    case "inicio": return `Carrera: ${d.carrera ?? "—"}`;
    case "docente_sin_seb": return d.sinSeb ? "habilitado sin SEB" : "SEB requerido";
    default: return "";
  }
}

function DetalleAlumno({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiAdmin<Detalle>(`/api/admin/asignaciones/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal ancho" role="dialog" aria-modal="true" aria-label="Detalle del alumno" onClick={(e) => e.stopPropagation()}>
        {!d ? <p className={error ? "error" : ""}>{error || "Cargando…"}</p> : (
          <>
            <div className="acciones"><h2 style={{ flex: 1, margin: 0 }}>{d.nombre} · LU {d.lu}</h2><button className="secundario chico" onClick={onCerrar}>Cerrar</button></div>
            <p className="sutil">
              {d.mail} · Carrera: {d.carrera ?? "—"} · Tema {d.tema}{d.parte ? ` parte ${d.parte}` : ""} ({d.tema_titulo})<br />
              Inicio: {fechaHora(d.iniciado_en)} · Vence: {fechaHora(d.vence_en)} · Entrega: {fechaHora(d.entregado_en)}
              {d.codigo && <><br />Código: <span className="mono">{d.codigo}</span></>}
              {d.mail_estado && <><br />Mail: {d.mail_estado}{d.mail_error ? ` (${d.mail_error})` : ""}</>}
            </p>
            {d.estado === "entregado" && <a className="boton" href={`/api/admin/asignaciones/${d.id}/pdf`} target="_blank" rel="noreferrer">Ver PDF</a>}
            <h3 style={{ marginTop: 16 }}>Respuestas</h3>
            {d.consignas.map((c, i) => (
              <div key={c.id} className="caja">
                <strong>Consigna {i + 1}{c.parte ? ` (${c.parte})` : ""} — {c.titulo}</strong> <span className="sutil">({c.puntaje} pts · guardada {hora(c.actualizadoEn)})</span>
                {c.html ? <div className="html" dangerouslySetInnerHTML={{ __html: c.html }} /> : <p className="sutil">(sin respuesta)</p>}
              </div>
            ))}
            <h3>Registro de eventos</h3>
            <table className="tabla">
              <thead><tr><th>Hora</th><th>Evento</th><th>Detalle</th></tr></thead>
              <tbody>
                {d.eventos.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{hora(e.cliente_ts ?? e.creado_en)}</td>
                    <td>{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</td>
                    <td>
                      {describirEvento(e)}
                      {e.tipo === "pegado" && typeof e.detalle.muestra === "string" && (
                        <details><summary className="sutil">Ver texto pegado</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>{e.detalle.muestra}</pre></details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultados: nota final, mails, exportación

function Resultados({ examen }: { examen: Examen }) {
  const [filas, setFilas] = useState<FilaAlumno[]>([]);
  const [detalle, setDetalle] = useState<string | null>(null);
  const aviso = useAviso();
  const { mostrar } = aviso;
  const cargar = useCallback(() => {
    apiAdmin<FilaAlumno[]>(`/api/admin/examenes/${examen.id}/alumnos`).then(setFilas).catch((e) => mostrar(e.message, true));
  }, [examen.id, mostrar]);
  useEffect(cargar, [cargar]);

  const nota = (puntaje: number | null) => {
    if (puntaje === null) return "";
    let n = examen.escala[0]?.nota ?? "";
    for (const b of examen.escala) if (puntaje >= b.desde) n = b.nota;
    return n;
  };

  async function guardarNota(f: FilaAlumno, valor: string) {
    try {
      await apiAdmin(`/api/admin/asignaciones/${f.id}`, { metodo: "PUT", cuerpo: { notaFinal: valor === "" ? null : valor } });
      mostrar(`Nota de ${f.nombre} guardada.`);
      cargar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  }

  const fallidos = filas.filter((f) => f.estado === "entregado" && f.mail_estado !== "enviado").length;
  return (
    <>
      {aviso.nodo}
      <div className="acciones" style={{ marginBottom: 12 }}>
        <a className="boton" href={`/api/admin/examenes/${examen.id}/csv`}>Exportar CSV (para el sistema UADE)</a>
        {fallidos > 0 && (
          <button className="secundario" onClick={async () => {
            try {
              const r = await apiAdmin<{ enviados: number; fallidos: number }>(`/api/admin/examenes/${examen.id}/accion`, { cuerpo: { accion: "reintentar_mails" } });
              mostrar(`Mails reenviados: ${r.enviados}. Fallidos: ${r.fallidos}.`, r.fallidos > 0);
              cargar();
            } catch (e) {
              mostrar(e instanceof Error ? e.message : "Error", true);
            }
          }}>Reintentar {fallidos} mails no enviados</button>
        )}
      </div>
      <table className="tabla tabla-cards">
        <thead><tr><th>Alumno</th><th>Carrera</th><th>Tema</th><th>Estado</th><th>Mail</th><th>Puntaje final (0–100)</th><th>Nota</th><th></th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td data-label="Alumno">{f.nombre}<div className="sutil">LU {f.lu}</div></td>
              <td data-label="Carrera">{f.carrera ?? "—"}</td>
              <td data-label="Tema">{f.tema}{f.parte ? ` (${f.parte})` : ""}</td>
              <td data-label="Estado"><EstadoAsignacion estado={f.estado} /></td>
              <td data-label="Mail">
                {f.mail_estado === "enviado" ? <span className="etiqueta verde">Enviado</span> : f.mail_estado === "error" ? <span className="etiqueta roja" title={f.mail_error ?? ""}>Error</span> : f.mail_estado ? <span className="etiqueta">Pendiente</span> : "—"}
              </td>
              <td data-label="Puntaje final">
                <input type="number" min={0} max={100} step="0.5" defaultValue={f.nota_final ?? ""} style={{ width: 90 }} aria-label={`Puntaje final de ${f.nombre}`}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== String(f.nota_final ?? "")) guardarNota(f, v);
                  }} />
              </td>
              <td data-label="Nota"><strong>{nota(f.nota_final)}</strong></td>
              <td>
                <div className="acciones">
                  <button className="secundario chico" onClick={() => setDetalle(f.id)}>Detalle</button>
                  {f.estado === "entregado" && <a className="chico" href={`/api/admin/asignaciones/${f.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detalle && <DetalleAlumno id={detalle} onCerrar={() => setDetalle(null)} />}
    </>
  );
}
