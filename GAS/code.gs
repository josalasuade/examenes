// ⚙️ CONFIGURACIÓN DE CAMPOS PRELLENADOS DE GOOGLE FORMS
const CONFIG_FORM = {
  NOMBRE_HOJA: "links",
  HOJA_ENUNCIADOS: "enunciados",
  ENTRY_TOKEN: "entry.1381169088",
  ENTRY_LU: "entry.1360613402",
  ENTRY_NOMBRE: "entry.1079177753"
};

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Examen Digital - UADE')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/*
// 1. Valida el sello del User-Agent (I4) y la firma SHA-256 de SEB (I2/I3)
function validarEntornoSEB(urlCliente, bekRecibido, ckRecibido, userAgentCliente, referrerCliente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerHojaLinks_(ss);

  var selloEsperado = String(sheet.getRange("I4").getValue() || "").trim();
  if (selloEsperado) {
    if (!userAgentCliente || String(userAgentCliente).indexOf(selloEsperado) === -1) {
      return { ok: false, motivo: "User-Agent sin sello oficial (I4)." };
    }
  }

  var claveI2 = String(sheet.getRange("I2").getValue() || "").trim();
  var claveI3 = String(sheet.getRange("I3").getValue() || "").trim();

  if (claveI2 || claveI3) {
    var firmaRecibida = String(ckRecibido || bekRecibido || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(firmaRecibida)) {
      return { ok: false, motivo: "Firma criptográfica de SEB ausente o inválida." };
    }
  }

  return { ok: true };
}*/

// 1. Activar esta si no queremos SEB.
function validarEntornoSEB(urlCliente, bekRecibido, ckRecibido, userAgentCliente, referrerCliente) {
  return { ok: true };
}

// 2. Valida código, marca Usado, registra Token (Col D) y Hora Inicio (Col J), y devuelve duración (I6)
function validarYObtenerLink(codigo) {
  if (!codigo) {
    return { success: false, message: "Por favor, ingresa un código válido." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Servidor ocupado, intenta nuevamente en 2 segundos." };
  }

  try {
    var codigoBuscado = String(codigo).trim().toUpperCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = obtenerHojaLinks_(ss);
    var data = sheet.getDataRange().getValues();
    var duracionMinutos = obtenerDuracionMinutos_(sheet);

    for (var i = 1; i < data.length; i++) {
      var codigoFila = String(data[i][0] || "").trim().toUpperCase(); // Col A: código
      var estado = String(data[i][1] || "").trim();                    // Col B: estado
      var urlBase = String(data[i][2] || data[i][6] || "").trim();     // Col C: link (respaldo Col G: Original)
      var nombreAlumno = String(data[i][4] || "").trim();              // Col E: NombreApellido
      var lu = String(data[i][5] || "").trim();                        // Col F: LU

      if (codigoFila === codigoBuscado) {
        if (estado.toLowerCase() === "disponible") {
          var cleanUrl = sanitizarUrl(urlBase);
          if (cleanUrl.indexOf("docs.google.com/forms/") === -1) {
            return { success: false, message: "Error de configuración: el alumno no tiene un link de Google Forms válido." };
          }

          var tokenSesion = "SEB-" + Utilities.getUuid().slice(0, 8).toUpperCase();
          var horaInicio = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm:ss");

          sheet.getRange(i + 1, 2).setValue("Usado");       // Col B: estado
          sheet.getRange(i + 1, 4).setValue(tokenSesion);   // Col D: tokenSEB
          sheet.getRange(i + 1, 10).setValue(horaInicio);   // Col J: horaInicio
          SpreadsheetApp.flush();

          var urlFinal = construirUrlFormulario(cleanUrl, {
            token: tokenSesion,
            lu: lu,
            nombre: nombreAlumno
          });

          var enunciado = obtenerEnunciadoPorLink(ss, cleanUrl);

          return {
            success: true,
            url: urlFinal,
            enunciado: enunciado,
            duracionMinutos: duracionMinutos,
            alumno: {
              lu: lu,
              nombre: nombreAlumno,
              token: tokenSesion
            }
          };
        } else {
          return { success: false, message: "Este código ya ha sido utilizado." };
        }
      }
    }

    return { success: false, message: "Código no encontrado. Verifica el código e intenta nuevamente." };
  } finally {
    lock.releaseLock();
  }
}

// Busca el enunciado correspondiente al link del Form en la solapa "enunciados"
function obtenerEnunciadoPorLink(ss, urlForm) {
  var sheetEnunciados = ss.getSheetByName(CONFIG_FORM.HOJA_ENUNCIADOS);
  if (!sheetEnunciados) {
    return {
      titulo: "Enunciado del Examen",
      html: "<p><em>Crea la solapa <strong>enunciados</strong> (Columnas: linkForm | titulo | enunciado) para cargar aquí las consignas.</em></p>"
    };
  }

  var data = sheetEnunciados.getDataRange().getValues();
  var urlBuscada = urlForm.split("?")[0].trim();
  var filaElegida = null;

  for (var i = 1; i < data.length; i++) {
    var linkFila = sanitizarUrl(String(data[i][0] || "")).split("?")[0].trim();
    if (linkFila && linkFila === urlBuscada) {
      filaElegida = data[i];
      break;
    }
  }

  if (!filaElegida && data.length > 1) {
    filaElegida = data[1];
  }

  if (!filaElegida) {
    return { titulo: "Enunciado del Examen", html: "<p>Sin consigna cargada.</p>" };
  }

  var titulo = String(filaElegida[1] || "Enunciado del Examen").trim();
  var textoCrudo = String(filaElegida[2] || "").trim();
  var htmlFormateado = /<(p|div|table|ul|ol|h[1-6])\b/i.test(textoCrudo)
    ? textoCrudo
    : textoCrudo.replace(/\r?\n/g, "<br>");

  return { titulo: titulo, html: htmlFormateado };
}

function construirUrlFormulario(baseUrl, datos) {
  var urlSinQuery = baseUrl.split("?")[0];
  var params = ["usp=pp_url", "embedded=true"];

  if (CONFIG_FORM.ENTRY_TOKEN && datos.token) {
    params.push(CONFIG_FORM.ENTRY_TOKEN + "=" + encodeURIComponent(datos.token));
  }
  if (CONFIG_FORM.ENTRY_LU && datos.lu) {
    params.push(CONFIG_FORM.ENTRY_LU + "=" + encodeURIComponent(datos.lu));
  }
  if (CONFIG_FORM.ENTRY_NOMBRE && datos.nombre) {
    params.push(CONFIG_FORM.ENTRY_NOMBRE + "=" + encodeURIComponent(datos.nombre));
  }

  return urlSinQuery + "?" + params.join("&");
}

function sanitizarUrl(input) {
  var str = input.toString().trim();
  var markdownMatch = str.match(/\((https?:\/\/[^\s\)]+)\)/i);
  if (markdownMatch) str = markdownMatch[1];

  str = str.replace(/[\[\]]/g, '').trim();
  if (str && !str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  str = str.replace(/docs\.google\.com\/a\/[^\/]+\/forms\//i, "docs.google.com/forms/");
  return str;
}

function obtenerHojaLinks_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase() === CONFIG_FORM.NOMBRE_HOJA.toLowerCase()) {
      return sheets[i];
    }
  }
  return ss.getActiveSheet();
}

function obtenerDuracionMinutos_(sheet) {
  var texto = String(sheet.getRange("I6").getDisplayValue() || "").trim();
  if (!texto) return 0;
  if (texto.indexOf(":") !== -1) {
    var partes = texto.split(":");
    var horas = parseInt(partes[0], 10) || 0;
    var mins = parseInt(partes[1], 10) || 0;
    return (horas * 60) + mins;
  }
  var num = parseInt(texto.replace(/[^\d]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

// MENUES 

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Exámenes')
    .addItem('Revisar examen activo', 'menuRevisarExamen')
    .addItem('Generar examen activo', 'menuGenerarExamen')
    .addSeparator()
    .addItem('Mostrar examen activo', 'menuMostrarExamenActivo')
    .addToUi();
}

function menuRevisarExamen() {
  const ui = SpreadsheetApp.getUi();

  try {
    revisarExamenActivo();

    ui.alert(
      'Validación correcta',
      'El examen activo está listo para generarse.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      'Error de validación',
      error.message,
      ui.ButtonSet.OK
    );
  }
}

function menuGenerarExamen() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const examen = obtenerExamenActivo_(ss);

    if (!examen) {
      ui.alert(
        'No hay examen activo',
        'No existe ningún examen marcado como ACTIVO = SI.',
        ui.ButtonSet.OK
      );
      return;
    }

    const respuesta = ui.alert(
      'Generar examen',
      'Se agregará:\n\n' +
      examen.tituloSeccion +
      '\n\nCódigo: ' +
      examen.codigo +
      '\n\nal Google Form configurado.\n\n' +
      'No se eliminará ninguna pregunta existente.\n\n' +
      '¿Desea continuar?',
      ui.ButtonSet.YES_NO
    );

    if (respuesta !== ui.Button.YES) {
      return;
    }

    generarExamenActivo();

    ui.alert(
      'Examen generado',
      'El examen fue agregado correctamente al Google Form.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      'Error al generar',
      error.message,
      ui.ButtonSet.OK
    );
  }
}

function menuMostrarExamenActivo() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const examen = obtenerExamenActivo_(ss);

    if (!examen) {
      ui.alert(
        'No hay examen activo',
        'No existe ningún examen marcado como ACTIVO = SI.',
        ui.ButtonSet.OK
      );
      return;
    }

    const items = obtenerItemsExamen_(ss, examen.codigo);

    let total = 0;

    for (const item of items) {
      total += Number(item.puntos || 0);
    }

    ui.alert(
      'Examen activo',
      'Código: ' + examen.codigo +
      '\n\nTítulo: ' + examen.tituloSeccion +
      '\n\nItems: ' + items.length +
      '\n\nPuntaje total: ' + total +
      '\n\nForm ID:\n' + examen.formId,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      'Error',
      error.message,
      ui.ButtonSet.OK
    );
  }
}
