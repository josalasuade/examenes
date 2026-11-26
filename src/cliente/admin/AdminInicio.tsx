"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "../Modal";
import { apiAdmin, EstadoExamen, useAviso } from "./comun";

type Examen = { id: string; materia: string; instancia: string; fecha: string; estado: string; duracion_min: number; temas: number; alumnos: number; entregados: number };

export function AdminInicio() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  useEffect(() => {
    apiAdmin<{ autenticado: boolean }>("/api/admin/sesion").then((r) => setAutenticado(r.autenticado)).catch(() => setAutenticado(false));
  }, []);
  if (autenticado === null) return <div className="centro"><p>Cargando…</p></div>;
  if (!autenticado) return <Login onOk={() => setAutenticado(true)} />;
  return <Inicio onSalir={() => setAutenticado(false)} />;
}

function Login({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="centro">
      <form
        className="tarjeta"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnviando(true);
          setError("");
          try {
            await apiAdmin("/api/admin/sesion", { cuerpo: { password } });
            onOk();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
          } finally {
            setEnviando(false);
          }
        }}
      >
        <h1>Panel docente</h1>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        <button disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </div>
  );
}

function Inicio({ onSalir }: { onSalir: () => void }) {
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const aviso = useAviso();
  const { mostrar } = aviso;
  const cargar = useCallback(() => {
    apiAdmin<Examen[]>("/api/admin/examenes").then(setExamenes).catch((e) => mostrar(e.message, true));
  }, [mostrar]);
  useEffect(cargar, [cargar]);

  return (
    <div className="panel">
      <div className="panel-cabecera">
        <h1>Exámenes</h1>
        <a href="/admin/carreras">Carreras</a>
        <a href="/admin/verificar">Verificar PDF</a>
        <button onClick={() => setNuevo(true)}>+ Nuevo examen</button>
        <button
          className="secundario"
          onClick={async () => {
            await apiAdmin("/api/admin/sesion", { metodo: "DELETE", cuerpo: {} });
            onSalir();
          }}
        >
          Salir
        </button>
      </div>
      {aviso.nodo}
      {examenes.length === 0 ? (
        <div className="caja"><p>No hay exámenes todavía. Creá el primero con “+ Nuevo examen”.</p></div>
      ) : (
        <table className="tabla tabla-cards">
          <thead>
            <tr><th>Fecha</th><th>Materia</th><th>Instancia</th><th>Estado</th><th>Temas</th><th>Alumnos</th><th>Entregados</th></tr>
          </thead>
          <tbody>
            {examenes.map((e) => (
              <tr key={e.id}>
                <td data-label="Fecha">{e.fecha.split("-").reverse().join("/")}</td>
                <td data-label="Materia"><a href={`/admin/examenes/${e.id}`}>{e.materia}</a></td>
                <td data-label="Instancia">{e.instancia}</td>
                <td data-label="Estado"><EstadoExamen estado={e.estado} /></td>
                <td data-label="Temas">{e.temas}</td>
                <td data-label="Alumnos">{e.alumnos}</td>
                <td data-label="Entregados">{e.entregados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <NuevoExamen abierto={nuevo} onCerrar={() => setNuevo(false)} />
    </div>
  );
}

function NuevoExamen({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [f, setF] = useState({ materia: "Ingeniería de Software", docente: "", instancia: "1° Parcial", fecha: new Date().toISOString().slice(0, 10), duracionMin: 120 });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "duracionMin" ? Number(e.target.value) : e.target.value });
  return (
    <Modal
      abierto={abierto}
      titulo="Nuevo examen"
      onCerrar={onCerrar}
      acciones={
        <>
          <button className="secundario" onClick={onCerrar}>Cancelar</button>
          <button
            onClick={async () => {
              setError("");
              try {
                const r = await apiAdmin<{ id: string }>("/api/admin/examenes", { cuerpo: f });
                location.href = `/admin/examenes/${r.id}`;
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            Crear
          </button>
        </>
      }
    >
      <label>Materia<input value={f.materia} onChange={set("materia")} /></label>
      <label>Docente<input value={f.docente} onChange={set("docente")} /></label>
      <div className="fila">
        <label>Instancia<input value={f.instancia} onChange={set("instancia")} /></label>
        <label>Fecha<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
        <label>Duración (min)<input type="number" min={1} max={600} value={f.duracionMin} onChange={set("duracionMin")} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </Modal>
  );
}
