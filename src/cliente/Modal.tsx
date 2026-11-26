"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Modal propio (nunca confirm()/alert() nativos).
export function Modal({
  abierto,
  titulo,
  children,
  onCerrar,
  acciones,
}: {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  onCerrar?: () => void;
  acciones?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCerrar) onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="modal-fondo" role="presentation" onClick={onCerrar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{titulo}</h2>
        <div className="modal-cuerpo">{children}</div>
        {acciones && <div className="modal-acciones">{acciones}</div>}
      </div>
    </div>
  );
}
