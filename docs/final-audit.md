# Revisión final · Morphiq QR 2.2.2

Fecha: 11 de octubre de 2026. Revisión del código, lectura real de archivos generados, pruebas automatizadas del navegador y comprobación visual de escritorio y móvil.

## Cambios y correcciones

- Silueta PNG: al cargarla o reactivarla se establece margen cero y se desactiva el marco. Una imagen central corriente conserva el margen elegido. Los ajustes posteriores guardados en un proyecto se restauran sin sobrescribirlos.
- Cámara: ocupa todo el viewport. La región decodificada coincide con el recorte visible; el resultado congela el cuadro y detiene las pistas, temporizadores y linterna. Las sesiones obsoletas liberan cámaras recibidas después de salir del lector.
- Revisión adicional de cámara/PWA: arranque al entrar al lector y reanudación en primer plano con permiso; cancelación de solicitudes pendientes; guía para conservar permisos según dispositivo y preferencia de arranque. No vuelve a pedir permiso automáticamente después de un rechazo. Una parada manual, un QR detectado o una imagen elegida conservan su estado. Los permisos revocados detienen la cámara; una desconexión y una cámara ocupada muestran recuperación sin bucles de solicitud.
- Recuperación móvil 2.2.2: se reprodujo el bloqueo causado por una consulta de permisos sin respuesta (ninguna llamada a `getUserMedia` antes de la corrección). La consulta ahora tiene un límite de espera y es informativa. Un toque llega a la solicitud en el mismo ciclo de interacción; un permiso restablecido limpia el bloqueo guardado. Los ajustes de cámara incompatibles se reintentan con video simple, sin audio, y las solicitudes o reproducciones que no responden ofrecen reintento sin perder el control del lector. Las pistas tardías de sesiones canceladas se liberan.
- La guía distingue permiso del sitio, acceso del navegador y permiso del sistema. Explica el caso de una PWA con solo Notificaciones en los ajustes Android. Ofrece abrir/copiar el lector, captura mediante cámara del sistema y soporte; en navegadores con `HTMLUserMediaElement`, incorpora autorización nativa y recibe su stream sin duplicar solicitudes. El resto conserva la ruta estándar.
- Los controles y el estado del lector comparten una barra adaptable para evitar superposiciones en pantallas estrechas y horizontales. La guía es accesible por teclado, se puede cerrar con Escape y conserva el foco y las preferencias.
- Resultado: el QR reconstruido contiene la carga original completa, independiente de la descripción del contenido. Conserva escapes Wi-Fi, asuntos y cuerpos de correo, números, vCard y calendario. Los enlaces se abren únicamente con una acción del usuario.
- Compartir: el generador y el lector preparan un PNG. Web Share recibe solo el archivo, sin mensaje, título ni URL. Se conserva el gesto necesario para abrir el menú del sistema. Cancelar no abre ni descarga nada; sin compartir archivos, se descarga el PNG. El generador exige las cuatro lecturas del diseño actual.
- Una carga de imagen inválida limpia los resultados y acciones anteriores. La linterna cambia de estado solamente cuando la cámara acepta el ajuste y se reinicia al detenerla.
- La galería conserva los 43 marcos y sus familias, sin buscador. Los textos independientes y exportaciones permanecen disponibles.
- El autoguardado serializa también el guardado al pasar al fondo y antes de actualizar la PWA, evitando que un borrador anterior sobrescriba la última edición.
- La disposición del lector en horizontal coloca QR, información y acciones juntos. Se mantienen controles accesibles por teclado, foco del resultado, texto inerte y preferencia de movimiento reducido.

## Cobertura de comprobación

| Área       | Comprobación                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contenidos | 13 formularios y cargas completas: liga, WhatsApp, Wi-Fi, contacto, teléfono, correo, evento, Spotify, redes, app, mapa, texto y SMS                                                 |
| Diseño     | Catálogo, compatibilidad entre esquinas y centros, módulos conectados, degradados y contraste; 43 marcos con cuatro lecturas por composición                                         |
| Imágenes   | Logos populares a color, imagen central/vector, ventana por módulos completos, zoom independiente, X/Y continuo, textura, fondo y silueta de margen cero                             |
| Archivos   | Lectura real de PNG/JPG/WebP/SVG y PDF rasterizado; fotografías y vectores; medidas físicas y densidad de impresión                                                                  |
| Proyectos  | Autoguardado, recuperación, guardado local, respaldo/importación JSON, rechazo de imágenes remotas y conservación de decisiones guardadas                                            |
| Estudio    | Comparación A/B, reparación sugerida, deshacer conservando cambios posteriores, paneles plegables y vista previa flotante                                                            |
| Lotes      | ZIP con archivos legibles, comprobación por elemento y reporte de elementos inválidos omitidos                                                                                       |
| Compartir  | Contrato de archivos PNG sin texto, carga exacta reconstruida, diseño actualizado, cancelación y descarga alternativa                                                                |
| Lector     | Cámara simulada con fotogramas reales de QR en escritorio y móvil, región visible, permisos rechazados, liberación de pistas, archivos inválidos y ausencia de navegación automática |
| Móvil      | Anchos de 320/390 px y horizontal 844×390, sin desbordamiento; selector propio de colores, controles de resultado y vista previa                                                     |
| PWA        | Arranque en lector, caché, lectura de imágenes, generación y comprobación sin conexión tras la primera carga                                                                         |

La batería contiene **12 pruebas unitarias, 17 de integración y 35 de navegador**. Las pruebas del contrato nativo de compartir sustituyen el menú del sistema por un capturador: se verifica el archivo y su lectura, sin enviar mensajes reales. Las pruebas PDF necesitan Poppler.

## Límites de la revisión

La cámara se prueba con un MediaStream de fotogramas conocidos y con errores de permisos simulados. No se han realizado pruebas físicas en cada modelo de Android/iPhone ni envíos reales mediante WhatsApp. Las aplicaciones disponibles en Compartir dependen del navegador, el sistema y las aplicaciones instaladas. Ninguna comprobación digital garantiza lectura bajo todas las condiciones de impresión, reflejos, daños o lentes; los diseños que no pasan las lecturas deben ajustarse.

La aplicación no puede conceder ni convertir un permiso temporal en permanente. Android ofrece «Mientras se usa la app» para cámara; «Todo el tiempo» corresponde a ubicación. El navegador puede recordar el permiso del sitio, retirarlo o separarlo entre Safari y una app instalada. La guía explica las opciones disponibles sin prometer que una página pueda controlar esos ajustes. Referencias: [Google Chrome](https://support.google.com/chrome/answer/2693767), [Android](https://support.google.com/android/answer/9431959), [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) y [Permissions.query](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query).

## Reproducir

```sh
npm ci
npm run check
npm run format:check
npx playwright install chromium
npm run test:e2e
```

La publicación conserva el repositorio `M1gu3hb/Morphiq-QRs` y el único proyecto Vercel `morphiqqr` con dominio `morphiqqr.vercel.app`.
