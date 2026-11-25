const HOJA_EXAMENES = 'EXAMENES';
const HOJA_ITEMS = 'ITEMS';


/**
 * ============================================================
 * FUNCIÓN PRINCIPAL
 * ============================================================
 *
 * Lee el examen ACTIVO desde EXAMENES,
 * lee sus preguntas desde ITEMS
 * y las agrega al Google Form indicado.
 *
 * NO borra preguntas existentes.
 * NO crea un formulario nuevo.
 *
 * ============================================================
 */

function generarExamenActivo() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ------------------------------------------------------------
  // 1. Leer examen activo
  // ------------------------------------------------------------

  const examen = obtenerExamenActivo_(ss);

  if (!examen) {
    throw new Error(
      'No existe ningún examen marcado como ACTIVO = SI.'
    );
  }

  // ------------------------------------------------------------
  // 2. Leer items
  // ------------------------------------------------------------

  const items = obtenerItemsExamen_(
    ss,
    examen.codigo
  );

  if (items.length === 0) {
    throw new Error(
      'No existen ITEMS para el examen: ' +
      examen.codigo
    );
  }

  // ------------------------------------------------------------
  // 3. Validar todo ANTES de modificar Forms
  // ------------------------------------------------------------

  validarExamen_(
    examen,
    items
  );

  Logger.log(
    'Validación OK: ' +
    items.length +
    ' items listos para importar.'
  );

  // ------------------------------------------------------------
  // 4. Abrir formulario existente
  // ------------------------------------------------------------

  const form =
    FormApp.openById(
      examen.formId
    );

  // ------------------------------------------------------------
  // 5. Habilitar modo Cuestionario si hay puntajes
  // ------------------------------------------------------------

  const requiereCuestionario =
    items.some(
      item => item.puntos > 0
    );

  if (
    requiereCuestionario &&
    !form.isQuiz()
  ) {

    form.setIsQuiz(true);

    Logger.log(
      'Se habilitó automáticamente el modo Cuestionario.'
    );
  }

  // ------------------------------------------------------------
  // 6. Evitar duplicados
  // ------------------------------------------------------------

  const marcador =
    '[EXAMEN:' +
    examen.codigo +
    '] ' +
    examen.tituloSeccion;

  if (
    examenYaExiste_(
      form,
      marcador
    )
  ) {

    throw new Error(
      'El examen "' +
      examen.codigo +
      '" ya existe en este formulario.'
    );
  }

  // ------------------------------------------------------------
  // 7. Crear sección inicial
  // ------------------------------------------------------------

  const pagina =
    form.addPageBreakItem();

  pagina.setTitle(
    marcador
  );

  pagina.setHelpText(
    examen.descripcion || ''
  );

  Utilities.sleep(300);

  // ------------------------------------------------------------
  // 8. Crear los items
  // ------------------------------------------------------------

  for (const item of items) {

    Logger.log(
      'Agregando ORDEN=' +
      item.orden +
      ' | TIPO=' +
      item.tipo +
      ' | TITULO="' +
      item.titulo +
      '"'
    );

    switch (item.tipo) {

      case 'SECCION':

        agregarSeccion_(
          form,
          item
        );

        break;


      case 'PARRAFO':

        agregarParrafo_(
          form,
          item
        );

        break;


      case 'TEXTO':

        agregarTextoCorto_(
          form,
          item
        );

        break;


      case 'MULTIPLE':

        agregarMultipleChoice_(
          form,
          item
        );

        break;


      case 'CHECKBOX':

        agregarCheckbox_(
          form,
          item
        );

        break;


      case 'SALTO':

        agregarSaltoPagina_(
          form,
          item
        );

        break;


      default:

        throw new Error(
          'Tipo de item desconocido: ' +
          item.tipo
        );
    }

    // Pausa breve entre escrituras
    Utilities.sleep(400);
  }

  // ------------------------------------------------------------
  // 9. Verificación final
  // ------------------------------------------------------------

  Utilities.sleep(1000);

  verificarExamenEnForm_(
    form,
    examen,
    items
  );

  // ------------------------------------------------------------
  // 10. Resultado
  // ------------------------------------------------------------

  Logger.log(
    '========================================'
  );

  Logger.log(
    'EXAMEN AGREGADO CORRECTAMENTE'
  );

  Logger.log(
    'Código: ' +
    examen.codigo
  );

  Logger.log(
    'Formulario: ' +
    form.getEditUrl()
  );

  Logger.log(
    'Preguntas agregadas: ' +
    items.length
  );

  Logger.log(
    '========================================'
  );
}


/**
 * ============================================================
 * FUNCIÓN DE REVISIÓN
 * ============================================================
 *
 * Ejecutala si querés revisar el Spreadsheet
 * SIN modificar el Google Form.
 *
 * ============================================================
 */

function revisarExamenActivo() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const examen =
    obtenerExamenActivo_(ss);

  if (!examen) {
    throw new Error(
      'No existe ningún examen marcado como ACTIVO = SI.'
    );
  }

  const items =
    obtenerItemsExamen_(
      ss,
      examen.codigo
    );

  Logger.log(
    '========================================'
  );

  Logger.log(
    'EXAMEN: ' +
    examen.codigo
  );

  Logger.log(
    'FORM ID: ' +
    examen.formId
  );

  Logger.log(
    'ITEMS: ' +
    items.length
  );

  Logger.log(
    '========================================'
  );

  for (const item of items) {

    Logger.log(
      'ORDEN=' +
      item.orden +
      ' | TIPO=' +
      item.tipo +
      ' | TITULO="' +
      item.titulo +
      '"' +
      ' | TEXTO=' +
      item.texto.length +
      ' caracteres' +
      ' | PUNTOS=' +
      item.puntos +
      ' | OBLIGATORIA=' +
      item.obligatoria
    );
  }

  validarExamen_(
    examen,
    items
  );

  Logger.log(
    '========================================'
  );

  Logger.log(
    'TODO CORRECTO. SE PUEDE GENERAR.'
  );

  Logger.log(
    '========================================'
  );
}


/**
 * ============================================================
 * LEER EXAMEN ACTIVO
 * ============================================================
 *
 * Hoja EXAMENES:
 *
 * CODIGO
 * FORM_ID
 * TITULO_SECCION
 * DESCRIPCION
 * ACTIVO
 *
 * ============================================================
 */

function obtenerExamenActivo_(ss) {

  const hoja =
    ss.getSheetByName(
      HOJA_EXAMENES
    );

  if (!hoja) {
    throw new Error(
      'No existe la hoja "' +
      HOJA_EXAMENES +
      '".'
    );
  }

  const datos =
    hoja.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return null;
  }

  const encabezados =
    datos.shift();

  const col =
    crearMapaColumnas_(
      encabezados
    );

  validarColumnas_(
    col,
    [
      'CODIGO',
      'FORM_ID',
      'TITULO_SECCION',
      'DESCRIPCION',
      'ACTIVO'
    ],
    HOJA_EXAMENES
  );

  const activos =
    datos.filter(
      fila =>
        normalizar_(
          fila[col.ACTIVO]
        ) === 'SI'
    );

  if (activos.length === 0) {
    return null;
  }

  if (activos.length > 1) {
    throw new Error(
      'Hay más de un examen marcado como ACTIVO = SI.'
    );
  }

  const fila =
    activos[0];

  return {

    codigo:
      String(
        fila[col.CODIGO] || ''
      ).trim(),

    formId:
      String(
        fila[col.FORM_ID] || ''
      ).trim(),

    tituloSeccion:
      String(
        fila[col.TITULO_SECCION] || ''
      ).trim(),

    descripcion:
      String(
        fila[col.DESCRIPCION] || ''
      ).trim()

  };
}


/**
 * ============================================================
 * LEER ITEMS
 * ============================================================
 *
 * Hoja ITEMS:
 *
 * EXAMEN
 * ORDEN
 * TIPO
 * TITULO
 * TEXTO
 * PUNTOS
 * OBLIGATORIA
 * OPCIONES
 *
 * ============================================================
 */

function obtenerItemsExamen_(
  ss,
  codigoExamen
) {

  const hoja =
    ss.getSheetByName(
      HOJA_ITEMS
    );

  if (!hoja) {
    throw new Error(
      'No existe la hoja "' +
      HOJA_ITEMS +
      '".'
    );
  }

  const datos =
    hoja.getDataRange()
      .getValues();

  if (datos.length < 2) {
    return [];
  }

  const encabezados =
    datos.shift();

  const col =
    crearMapaColumnas_(
      encabezados
    );

  validarColumnas_(
    col,
    [
      'EXAMEN',
      'ORDEN',
      'TIPO',
      'TITULO',
      'TEXTO',
      'PUNTOS',
      'OBLIGATORIA',
      'OPCIONES'
    ],
    HOJA_ITEMS
  );

  const resultado = [];

  for (const fila of datos) {

    const examen =
      String(
        fila[col.EXAMEN] || ''
      ).trim();

    if (
      examen !==
      codigoExamen
    ) {
      continue;
    }

    resultado.push({

      examen:
        examen,

      orden:
        Number(
          fila[col.ORDEN]
        ) || 0,

      tipo:
        normalizar_(
          fila[col.TIPO]
        ),

      titulo:
        String(
          fila[col.TITULO] || ''
        ).trim(),

      texto:
        String(
          fila[col.TEXTO] || ''
        ).trim(),

      puntos:
        Number(
          fila[col.PUNTOS]
        ) || 0,

      obligatoria:
        normalizar_(
          fila[col.OBLIGATORIA]
        ) === 'SI',

      opciones:
        String(
          fila[col.OPCIONES] || ''
        ).trim()

    });
  }

  resultado.sort(
    (a, b) =>
      a.orden - b.orden
  );

  return resultado;
}


/**
 * ============================================================
 * VALIDAR EXAMEN
 * ============================================================
 */

function validarExamen_(
  examen,
  items
) {

  if (!examen.codigo) {
    throw new Error(
      'El examen no tiene CODIGO.'
    );
  }

  if (!examen.formId) {
    throw new Error(
      'El examen no tiene FORM_ID.'
    );
  }

  if (!examen.tituloSeccion) {
    throw new Error(
      'El examen no tiene TITULO_SECCION.'
    );
  }

  const tiposPermitidos = [
    'SECCION',
    'PARRAFO',
    'TEXTO',
    'MULTIPLE',
    'CHECKBOX',
    'SALTO'
  ];

  const ordenes =
    new Set();

  for (const item of items) {

    // ----------------------------------------------------------
    // ORDEN
    // ----------------------------------------------------------

    if (!item.orden) {
      throw new Error(
        'Existe un item sin ORDEN.'
      );
    }

    if (
      ordenes.has(
        item.orden
      )
    ) {
      throw new Error(
        'ORDEN duplicado: ' +
        item.orden
      );
    }

    ordenes.add(
      item.orden
    );

    // ----------------------------------------------------------
    // TIPO
    // ----------------------------------------------------------

    if (
      !tiposPermitidos.includes(
        item.tipo
      )
    ) {
      throw new Error(
        'Tipo inválido "' +
        item.tipo +
        '" en ORDEN ' +
        item.orden
      );
    }

    // ----------------------------------------------------------
    // TITULO
    // ----------------------------------------------------------

    if (!item.titulo) {
      throw new Error(
        'Falta TITULO en ORDEN ' +
        item.orden
      );
    }

    // ----------------------------------------------------------
    // TEXTO
    // ----------------------------------------------------------

    if (
      [
        'SECCION',
        'PARRAFO',
        'TEXTO'
      ].includes(
        item.tipo
      ) &&
      !item.texto
    ) {

      throw new Error(
        'Falta TEXTO en ORDEN ' +
        item.orden +
        ': "' +
        item.titulo +
        '"'
      );
    }

    // ----------------------------------------------------------
    // OPCIONES
    // ----------------------------------------------------------

    if (
      (
        item.tipo === 'MULTIPLE' ||
        item.tipo === 'CHECKBOX'
      ) &&
      !item.opciones
    ) {

      throw new Error(
        'La pregunta "' +
        item.titulo +
        '" necesita OPCIONES.'
      );
    }
  }
}


/**
 * ============================================================
 * CREAR SECCIÓN
 * ============================================================
 */

function agregarSeccion_(
  form,
  item
) {

  const nuevo =
    form.addSectionHeaderItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * CREAR SALTO DE PÁGINA
 * ============================================================
 */

function agregarSaltoPagina_(
  form,
  item
) {

  const nuevo =
    form.addPageBreakItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * CREAR RESPUESTA LARGA
 * ============================================================
 */

function agregarParrafo_(
  form,
  item
) {

  const nuevo =
    form.addParagraphTextItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  nuevo.setRequired(
    item.obligatoria
  );

  if (
    item.puntos > 0
  ) {
    nuevo.setPoints(
      item.puntos
    );
  }

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * CREAR RESPUESTA CORTA
 * ============================================================
 */

function agregarTextoCorto_(
  form,
  item
) {

  const nuevo =
    form.addTextItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  nuevo.setRequired(
    item.obligatoria
  );

  if (
    item.puntos > 0
  ) {
    nuevo.setPoints(
      item.puntos
    );
  }

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * CREAR OPCIÓN MÚLTIPLE
 * ============================================================
 */

function agregarMultipleChoice_(
  form,
  item
) {

  const opciones =
    item.opciones
      .split('|')
      .map(
        x => x.trim()
      )
      .filter(
        Boolean
      );

  if (
    opciones.length === 0
  ) {
    throw new Error(
      'La pregunta "' +
      item.titulo +
      '" no tiene opciones.'
    );
  }

  const nuevo =
    form.addMultipleChoiceItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  nuevo.setChoiceValues(
    opciones
  );

  nuevo.setRequired(
    item.obligatoria
  );

  if (
    item.puntos > 0
  ) {
    nuevo.setPoints(
      item.puntos
    );
  }

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * CREAR CHECKBOX
 * ============================================================
 */

function agregarCheckbox_(
  form,
  item
) {

  const opciones =
    item.opciones
      .split('|')
      .map(
        x => x.trim()
      )
      .filter(
        Boolean
      );

  if (
    opciones.length === 0
  ) {
    throw new Error(
      'La pregunta "' +
      item.titulo +
      '" no tiene opciones.'
    );
  }

  const nuevo =
    form.addCheckboxItem();

  nuevo.setTitle(
    item.titulo
  );

  nuevo.setHelpText(
    item.texto
  );

  nuevo.setChoiceValues(
    opciones
  );

  nuevo.setRequired(
    item.obligatoria
  );

  if (
    item.puntos > 0
  ) {
    nuevo.setPoints(
      item.puntos
    );
  }

  verificarItemCreado_(
    nuevo,
    item
  );
}


/**
 * ============================================================
 * VERIFICAR ITEM RECIÉN CREADO
 * ============================================================
 */

function verificarItemCreado_(
  itemForm,
  itemOrigen
) {

  Utilities.sleep(
    300
  );

  const tituloGrabado =
    String(
      itemForm.getTitle() || ''
    ).trim();

  Logger.log(
    'Creado ORDEN=' +
    itemOrigen.orden +
    ' | Esperado="' +
    itemOrigen.titulo +
    '"' +
    ' | Grabado="' +
    tituloGrabado +
    '"'
  );

  if (
    tituloGrabado !==
    itemOrigen.titulo.trim()
  ) {

    throw new Error(
      'Google Forms no grabó correctamente el item ' +
      itemOrigen.orden +
      '. Esperado: "' +
      itemOrigen.titulo +
      '" / Grabado: "' +
      tituloGrabado +
      '"'
    );
  }
}


/**
 * ============================================================
 * VERIFICACIÓN FINAL DEL FORMULARIO
 * ============================================================
 */

function verificarExamenEnForm_(
  form,
  examen,
  items
) {

  const formItems =
    form.getItems();

  const titulosForm =
    formItems.map(
      x =>
        String(
          x.getTitle() || ''
        ).trim()
    );

  const faltantes = [];

  for (
    const item of items
  ) {

    if (
      !titulosForm.includes(
        item.titulo.trim()
      )
    ) {

      faltantes.push(
        item.orden +
        ' - ' +
        item.titulo
      );
    }
  }

  if (
    faltantes.length > 0
  ) {

    throw new Error(
      'El formulario terminó de generarse, ' +
      'pero faltan estos items:\n' +
      faltantes.join('\n')
    );
  }

  Logger.log(
    'Verificación final OK: ' +
    items.length +
    ' items encontrados correctamente.'
  );
}


/**
 * ============================================================
 * EVITAR DUPLICADOS
 * ============================================================
 */

function examenYaExiste_(
  form,
  marcador
) {

  const items =
    form.getItems();

  for (
    let i = 0;
    i < items.length;
    i++
  ) {

    const titulo =
      String(
        items[i].getTitle() || ''
      ).trim();

    if (
      titulo === marcador
    ) {
      return true;
    }
  }

  return false;
}


/**
 * ============================================================
 * MAPEAR ENCABEZADOS
 * ============================================================
 */

function crearMapaColumnas_(
  encabezados
) {

  const mapa = {};

  encabezados.forEach(
    (valor, indice) => {

      const nombre =
        normalizar_(
          valor
        )
        .replace(
          /\s+/g,
          '_'
        );

      mapa[nombre] =
        indice;
    }
  );

  return mapa;
}


/**
 * ============================================================
 * VALIDAR COLUMNAS
 * ============================================================
 */

function validarColumnas_(
  mapa,
  columnas,
  hoja
) {

  for (
    const columna of columnas
  ) {

    if (
      mapa[columna] ===
      undefined
    ) {

      throw new Error(
        'Falta la columna "' +
        columna +
        '" en la hoja "' +
        hoja +
        '".'
      );
    }
  }
}


/**
 * ============================================================
 * NORMALIZAR TEXTO
 * ============================================================
 */

function normalizar_(
  valor
) {

  return String(
    valor || ''
  )
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(
    /[\u0300-\u036f]/g,
    ''
  );
}
