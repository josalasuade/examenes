import { Suspense } from "react";
import { AdminExamen } from "@/cliente/admin/AdminExamen";

export default function Page() {
  return (
    <Suspense fallback={<div className="panel"><p>Cargando…</p></div>}>
      <AdminExamen />
    </Suspense>
  );
}
