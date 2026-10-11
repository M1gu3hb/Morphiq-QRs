# Mantenimiento

## Agregar contenidos

Declara el tipo y formulario en `src/content/controller.js` y su serialización en `payloads.js`. El resultado debe contener la información directa, sin un servicio de redirección. Agrega casos de escape y una prueba que codifique y vuelva a leer la carga completa. Para lotes, los encabezados CSV deben coincidir con los nombres de esos campos.

## Agregar estilos y marcos

El catálogo `src/qr/styles.js` genera nombres, contadores y muestras con `https://morphiq.com.mx`. Los trazados usan unidades de módulos; conserva los patrones protegidos y declara las compatibilidades de nuevas esquinas. Ofrece principalmente geometrías conectadas.

`src/frames/catalog.js` compone un SVG completo, incluyendo texto escapado, proporción y espacio exterior. Un marco nuevo debe superar las cuatro lecturas y conservar su aspecto en PNG/SVG/PDF. Las paletas y efectos de tinta están en `src/qr/color-effects.js`.

## Estado e imágenes

Los valores iniciales están en `src/app/defaults.js` y `src/advanced/options.js`; deben coincidir con `index.html`. Las herramientas de estudio son opcionales. No agregues valores derivados ni resultados de validación persistentes al estado.

Al extender el estado guardado, actualiza las comprobaciones de importación en `src/projects/state.js`. IndexedDB no depende de cookies. Nunca incluyas código ejecutable, enlaces remotos de imagen o HTML arbitrario dentro del estado.

Los logos SVG conservan sus vectores y se sanitizan. Los PNG de siluetas requieren transparencia y espacio interior suficiente. Cambiar una imagen debe invalidar verificaciones y operaciones anteriores.

## Exportadores

Cada exportador devuelve un Blob. Preview, comprobador, marcos y raster comparten `renderQrSvg()`. El PDF avanzado usa esa composición, con conversión de máscaras para vectores y rasterización solo del parche central de fotografías.

Una medida física incluye todo el diseño: marco y silueta. El alto se deriva de la proporción y no se fuerza a cuadrado. Prueba la lectura del archivo exportado, no solo del SVG de vista previa.

## Lotes CSV

Se admiten hasta 100 registros o una liga por línea. Ejemplo:

```csv
nombre,tipo,url,phone,message
Morphiq,url,https://morphiq.com.mx,,
WhatsApp,whatsapp,,525512345678,"Hola, quiero información"
```

Los tipos son `url`, `whatsapp`, `wifi`, `contact`, `phone`, `email`, `event`, `spotify`, `social`, `app`, `map`, `text`, `sms`.

Para Wi-Fi usa `ssid,password,security,hidden`; para contacto `name,company,phone,email,url,address`; para eventos `title,start,end,location,description` con fechas ISO. Mensajes con comas o saltos de línea deben ir entre comillas. La plantilla descargable incluye varios formatos. El reporte JSON indica los elementos omitidos.

## Pruebas

```sh
npm run check
npm run format:check
npx playwright install chromium
npm run test:e2e
```

Pruebas unitarias: contenidos y escapes, campañas, esquemas del lector, CSV, geometría, contraste y catálogo. Integración: lectura real, marcos, efectos, imágenes/siluetas, proyectos, vectores, densidad, descargas y worker. Navegador: formularios, móvil, autoguardado, comparación, reparación, PDF leído desde su rasterización, ZIP y funcionamiento offline del lector.

Las pruebas de navegador usan la compilación de `dist/` y requieren Poppler (`pdftoppm`). `MORPHIQ_BROWSER_EXECUTABLE` permite indicar un Chromium instalado; en CI se instala mediante Playwright. Los adaptadores de Canvas y DOM solo existen en las pruebas.

## PWA y publicación

`npm run build` genera el manifiesto copiado desde `public/`, los chunks y el service worker versionado. Añade nuevos recursos offline a `public/` o impórtalos desde los módulos; el script detecta la salida compilada. No uses servicios externos para recursos necesarios sin conexión. Verifica una recarga sin red después de la instalación inicial.

Vercel utiliza `npm ci`, `npm run build` y `dist`; no requiere variables de entorno ni servicios externos. Mantén un único proyecto `morphiqqr` y el dominio `morphiqqr.vercel.app`. Si cambia el dominio, actualiza juntos canonical, metadatos sociales y robots/sitemap.

No versiones `node_modules/`, `dist/`, `.vercel/`, resultados de pruebas, credenciales ni `.env`. El lockfile sí se versiona. Los commits del propietario se atribuyen a `M1gu3hb`.
