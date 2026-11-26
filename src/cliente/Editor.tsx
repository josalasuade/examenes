"use client";

import { EditorContent, useEditor, type Editor as TEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { useEffect } from "react";

export type InfoPegado = { caracteres: number; texto: string };

// Editor de texto con formato y tablas (TipTap).
// onTecla / onPegado alimentan el monitoreo del examen.
export function Editor({
  valorInicial,
  onCambio,
  onTecla,
  onPegado,
  etiqueta,
  deshabilitado = false,
}: {
  valorInicial: string;
  onCambio: (html: string) => void;
  onTecla?: () => void;
  onPegado?: (p: InfoPegado) => void;
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [3, 4] } }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: valorInicial,
    editable: !deshabilitado,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "editor-contenido", "aria-label": etiqueta, role: "textbox", "aria-multiline": "true" },
      handleKeyDown: (_v, e) => {
        if (e.key.length === 1 || e.key === "Enter") onTecla?.();
        return false;
      },
      handlePaste: (_v, e) => {
        const texto = e.clipboardData?.getData("text/plain") ?? "";
        onPegado?.({ caracteres: texto.length, texto });
        return false;
      },
      handleDrop: (_v, e) => {
        const texto = (e as DragEvent).dataTransfer?.getData("text/plain") ?? "";
        if (texto) onPegado?.({ caracteres: texto.length, texto });
        return false;
      },
    },
    onUpdate: ({ editor }) => onCambio(editor.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(!deshabilitado);
  }, [editor, deshabilitado]);

  return (
    <div className="editor">
      {editor && !deshabilitado && <BarraHerramientas editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function BarraHerramientas({ editor }: { editor: TEditor }) {
  const boton = (texto: string, titulo: string, accion: () => void, activo = false) => (
    <button
      type="button"
      className={activo ? "activo" : ""}
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={accion}
    >
      {texto}
    </button>
  );
  const c = () => editor.chain().focus();
  const enTabla = editor.isActive("table");
  return (
    <div className="editor-barra" role="toolbar">
      {boton("N", "Negrita", () => c().toggleBold().run(), editor.isActive("bold"))}
      {boton("I", "Cursiva", () => c().toggleItalic().run(), editor.isActive("italic"))}
      {boton("S", "Subrayado", () => c().toggleUnderline().run(), editor.isActive("underline"))}
      {boton("T", "Título", () => c().toggleHeading({ level: 3 }).run(), editor.isActive("heading"))}
      {boton("• Lista", "Lista con viñetas", () => c().toggleBulletList().run(), editor.isActive("bulletList"))}
      {boton("1. Lista", "Lista numerada", () => c().toggleOrderedList().run(), editor.isActive("orderedList"))}
      <span className="separador" />
      {boton("⊞ Tabla", "Insertar tabla 3×3", () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {enTabla && (
        <>
          {boton("+ Fila", "Agregar fila", () => c().addRowAfter().run())}
          {boton("+ Col", "Agregar columna", () => c().addColumnAfter().run())}
          {boton("− Fila", "Borrar fila", () => c().deleteRow().run())}
          {boton("− Col", "Borrar columna", () => c().deleteColumn().run())}
          {boton("✕ Tabla", "Borrar tabla", () => c().deleteTable().run())}
        </>
      )}
      <span className="separador" />
      {boton("↶", "Deshacer", () => c().undo().run())}
      {boton("↷", "Rehacer", () => c().redo().run())}
    </div>
  );
}
