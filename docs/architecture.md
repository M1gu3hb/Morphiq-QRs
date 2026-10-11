# Arquitectura

La aplicación usa JavaScript con módulos ES y Vite. La matriz QR, la geometría y la construcción de contenidos están separadas del DOM. `createStudio()` coordina una instancia del generador sin exponer su estado globalmente. El lector tiene un controlador independiente.

## Contenido y representación

1. `contentPayload()` construye la carga completa según el formulario: HTTP/HTTPS, Wi-Fi, vCard, calendario, teléfono, correo o texto. `withCampaign()` añade UTM directamente a la liga original.
2. `encodePayload()` genera la matriz; una imagen activa obliga a corrección H y versión mínima 3.
3. `renderQrSvg()` compone módulos, esquinas, tinta, imagen, silueta y marco. Vista previa, comprobador, descargas rasterizadas y PDF avanzado comparten esta composición.
4. `QRCheck.run()` decodifica cuatro variantes y compara el resultado exacto con la carga prevista. Cambiar el diseño invalida la verificación previa.
5. Cada exportador devuelve un Blob y `saveFile()` descarga el resultado localmente.

No existen endpoints de generación, cuentas, redirecciones propias ni backend. Las bibliotecas de ejecución se incluyen en la compilación. Los exportadores PDF y ZIP se cargan cuando se utilizan, pero el service worker también los prepara para uso sin conexión.

## Geometría e imágenes

El catálogo define las familias conectadas, presets y compatibilidades entre esquinas y centros. Los patrones estructurales mantienen sus módulos; una textura no sustituye los datos de sincronización o alineación.

La ventana central crece en unidades enteras: desde dos módulos hasta catorce, limitada también al 30% del ancho y al espacio libre de patrones. El codificador elige una versión que deje disponible el centro; con contenidos largos puede aumentar la densidad de la matriz. El tamaño de la ventana, el zoom de su contenido y la posición continua son independientes. X/Y admiten centésimas de módulo; el arrastre no redondea a módulos completos. La máscara mantiene visibles los patrones estructurales. No se reubican módulos codificados para rodear un logo. El editor se oculta si no existe una imagen activa.

Las imágenes se normalizan localmente a un máximo de 1024 píxeles y se recorta su relleno exterior. Un SVG se analiza como XML inerte y se conserva como vector estático, excluyendo scripts, eventos, recursos externos y elementos ejecutables. Los identificadores se separan por vista para evitar conflictos entre degradados o recortes.

Una silueta usa el canal alfa de un PNG. Un algoritmo encuentra el mayor cuadrado opaco interior; allí se coloca el QR intacto. Al cargar o reactivar una silueta se establece margen cero y se desactiva el marco decorativo. Las decisiones posteriores de un proyecto guardado se conservan al restaurarlo. El resto del contorno recibe una trama decorativa. Si la figura no ofrece una zona suficientemente amplia, se rechaza con una explicación. La decoración no se presenta como una redistribución válida de la matriz.

Los marcos tienen catálogo, controlador y renderer independientes. Sus 43 composiciones mantienen las coordenadas originales del QR, añadiendo decoración y hasta tres textos alrededor. El controlador está disponible sin modo estudio y crea las muestras antes de medir la animación de apertura. Una vista flotante sigue la composición actual cuando la vista principal queda fuera de pantalla; permite minimizar o ampliar el QR.

## Validación y exportación

El decodificador recibe buffers por transferencia en un worker con solicitudes identificadas y tiempo límite. Si Worker no está disponible, se utiliza el mismo lector en el hilo principal. Los resultados obsoletos se descartan mediante revisión y token.

La descarga individual verifica contraste y cuatro lecturas. Un lote usa una instantánea del diseño, comprueba cada contenido y omite los fallos en el ZIP con un reporte JSON. Una reparación ensaya variantes progresivas y ofrece un botón para aplicar la primera legible; la comparación conserva una instantánea A y muestra el diseño actual B. Cerrar una sugerencia o cambiar el diseño cancela sus resultados pendientes. Deshacer compara las propiedades modificadas por la reparación y restaura únicamente las que siguen iguales a la sugerencia aplicada: conserva cambios posteriores de contenido o ajustes manuales. Los paneles de revisión son plegables y los resultados de comprobación pueden ocultarse.

El PDF sencillo comparte los trazados del catálogo. Los diseños avanzados usan jsPDF y svg2pdf.js para mantener módulos, marcos, degradados y logos SVG vectoriales. Una composición central con fotografía y máscara se incorpora como un parche rasterizado de esa área, sin aplanar todo el QR. SVG conserva el vector completo y sus imágenes integradas.

En impresión, el ancho físico determina los píxeles según los dpi; el alto respeta la proporción del diseño completo. PNG/JPEG llevan densidad; SVG/PDF llevan medidas físicas. Las etiquetas A4 usan el mismo diseño y lo comprueban antes de colocarlo.

La opción de compartir rasteriza el mismo SVG como PNG. En el generador, una instantánea pasa las cuatro lecturas y se invalida al editar el diseño. En navegadores con Web Share, se prepara antes del clic para conservar la activación necesaria del usuario; si la preparación consume ese gesto, se pide volver a pulsar el botón. `navigator.share()` recibe exclusivamente `{ files: [archivoPNG] }`. Cancelar no descarga ni abre nada. Los navegadores que no admiten compartir archivos descargan ese PNG. El menú del sistema determina qué aplicaciones receptoras están disponibles.

## Guardado local

IndexedDB conserva el borrador y los proyectos con imágenes incluidas. La escritura se confirma cuando finaliza la transacción. El autoguardado usa un breve debounce y las escrituras se serializan, incluido el guardado al pasar al fondo y el guardado previo a actualizar la PWA; una escritura anterior no puede sobrescribir el último borrador. Un proyecto JSON se valida antes de cargarlo: versión, campos conocidos, estilos compatibles, imágenes locales y contorno acotado.

El borrador no es una cuenta ni una sincronización. Exportar JSON permite respaldar o mover el proyecto. Eliminar datos del sitio puede eliminarlo; el navegador determina las cuotas y disponibilidad del almacenamiento.

## Lector y PWA

La cámara se inicia al entrar al lector, salvo que el usuario desactive esa preferencia o que el permiso esté bloqueado. `camera-access.js` consulta Permissions API y observa cambios; tolera navegadores sin consulta de cámara y almacenamiento bloqueado. La preferencia local recuerda arranque, uso previo y rechazo, pero nunca sustituye un permiso del navegador. Al volver del fondo o de la caché de navegación, se reanuda únicamente una sesión deseada, sin resultado, en el lector visible y con permiso concedido. No repite automáticamente un aviso pendiente ni un rechazo. Una parada manual o una imagen seleccionada suspenden esa reanudación; la solicitud inicial se puede cancelar y las pistas recibidas después de cancelar se liberan.

Cada sesión tiene un token; cambiar vista, cerrar la página o pasar al fondo detiene las pistas. La cámara ocupa todo el viewport con `object-fit: cover`; se decodifica exactamente su región visible. Al reconocer un código se congela ese cuadro, se detienen las pistas, se dibujan las esquinas y se muestra el resultado. `scanResult()` conserva por separado la carga original y la descripción legible. `rebuildQr()` genera un QR negro/blanco completo con margen de cuatro módulos a partir de la carga exacta, sin perder parámetros de correo, escapes Wi-Fi ni líneas de vCard/ICS. Si el contenido excede la capacidad de M, se admite L para reconstruir una carga legítima. Solo produce acciones de navegación para esquemas permitidos; no navega automáticamente.

El manifiesto conserva el icono QR azul, nombre Morphiq QR y arranque en `/?app=1`. El navegador habitual muestra el generador; standalone muestra el lector. Los atajos permiten abrir cualquiera de los dos.

El build calcula una versión por hash y genera `dist/sw.js`. El worker prepara recursos propios, incluidos chunks y decodificador, mantiene navegación disponible sin conexión y elimina solo cachés antiguas de Morphiq. Una actualización espera al usuario; antes de activarla se guarda el borrador. No se precargan imágenes ni contenidos de destinos externos.

## Recursos

GLYPHOS permanece aislado en `public/vendor/glyphos-field.js`; la marca y la imagen social están en `public/assets/`. Las imágenes de referencia inspiraron familias de geometría y marcos, sin copiar ilustraciones o marcas de agua. Los recursos propios conservan su atribución al propietario del proyecto.
