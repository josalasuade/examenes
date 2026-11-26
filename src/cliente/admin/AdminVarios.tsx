"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAdmin, useAviso, useConfirmar } from "./comun";

type Carrera = { id: number; nombre: string; activa: boolean };

export function AdminCarreras() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [nueva, setNueva] = useState("");
  const aviso = useAviso();
  const { mostrar } = aviso;
  const confirmar = useConfirmar();
  const cargar = useCallback(() => {
    apiAdmin<Carrera[]>("/api/admin/carreras").then(setCarreras).catch((e) => mostrar(e.message, true));
  }, [mostrar]);
  useEffect(cargar, [cargar]);

  const ejecutar = async (f: () => Promise<unknown>) => {
    try {
      await f();
      cargar();
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Error", true);
    }
  };

  return (
    <div className="panel">
      <div className="panel-cabecera"><a href="/admin">← Exámenes</a><h1>Carreras</h1></div>
      <p className="sutil">Lista desplegable que ven los alumnos al comenzar. Si la lista está vacía, el alumno escribe la carrera.</p>
      {aviso.nodo}
      <form className="caja acciones" onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          await apiAdmin("/api/admin/carreras", { cuerpo: { nombre: nueva } });
          setNueva("");
        });
      }}>
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nombre de la carrera" style={{ flex: 1 }} aria-label="Nueva carrera" />
        <button disabled={!nueva.trim()}>Agregar</button>
      </form>
      <table className="tabla tabla-cards">
        <thead><tr><th>Carrera</th><th>Visible</th><th></th></tr></thead>
        <tbody>
          {carreras.map((c) => (
            <tr key={c.id}>
              <td data-label="Carrera">{c.nombre}</td>
              <td data-label="Visible">
                <label className="check" style={{ margin: 0 }}>
                  <input type="checkbox" checked={c.activa} onChange={(e) => ejecutar(() => apiAdmin(`/api/admin/carreras/${c.id}`, { metodo: "PUT", cuerpo: { nombre: c.nombre, activa: e.target.checked } }))} />
                  {c.activa ? "Sí" : "No"}
                </label>
              </td>
              <td>
                <button className="peligro chico" onClick={() => confirmar.pedir({
                  titulo: "Borrar carrera", peligro: true, mensaje: <p>Se borra “{c.nombre}” de la lista. Los exámenes ya rendidos conservan el texto.</p>, boton: "Borrar",
                  accion: async () => {
                    await apiAdmin(`/api/admin/carreras/${c.id}`, { metodo: "DELETE", cuerpo: {} });
                    cargar();
                  },
                })}>Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmar.nodo}
    </div>
  );
}

type Verificacion = { valido: boolean; nombre?: string; lu?: string; materia?: string; instancia?: string; entregado?: string; examen_id?: string };

export function AdminVerificar() {
  const [codigo, setCodigo] = useState("");
  const [r, setR] = useState<Verificacion | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="panel">
      <div className="panel-cabecera"><a href="/admin">← Exámenes</a><h1>Verificar un PDF</h1></div>
      <form className="caja" onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setR(null);
        try {
          setR(await apiAdmin<Verificacion>(`/api/admin/verificar?codigo=${encodeURIComponent(codigo)}`));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error");
        }
      }}>
        <label>Código de verificación impreso en el PDF<input className="mono" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ABCD-1234-…" /></label>
        <button disabled={!codigo.trim()}>Verificar</button>
        {error && <p className="error" role="alert">{error}</p>}
        {r && (r.valido ? (
          <p className="ok">✓ Código válido: {r.nombre} (LU {r.lu}) — {r.materia}, {r.instancia} — entregado el {r.entregado}. Compará el contenido del PDF con el de <a href={`/admin/examenes/${r.examen_id}`}>la entrega guardada</a>.</p>
        ) : (
          <p className="error">✗ El código no corresponde a ninguna entrega. El PDF no es auténtico o fue alterado.</p>
        ))}
      </form>
    </div>
  );
}
