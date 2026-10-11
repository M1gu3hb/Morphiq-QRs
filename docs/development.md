# Mantenimiento

## Agregar estilos

Agrega la forma y sus metadatos en `src/qr/styles.js`: `modules`, `eyes`, `centers` y `presets`. La galería, los nombres, los contadores y las miniaturas se generan a partir de ese catálogo. Las miniaturas codifican `https://morphiq.com.mx`.

Los trazados usan coordenadas de módulos, no píxeles. Extiende `modulePath()` o `eyePaths()` y conserva la protección de patrones estructurales. Para esquinas nuevas, declara los centros compatibles. Revisa SVG y PDF, y comprueba la lectura con ligas cortas y largas antes de ofrecer el estilo.

## Cambiar valores iniciales

`src/app/defaults.js` define los valores de restablecimiento y las resoluciones. Los controles en `index.html` deben usar los mismos valores de inicio. Las pruebas verifican la coherencia del margen y los colores.

## Agregar exportadores

Cada exportador recibe datos del diseño y devuelve un Blob. La selección y la descarga se coordinan en `create-studio.js`. SVG y raster comparten `renderQrSvg()`; PDF comparte la geometría vectorial de `QRStyles`. Evita introducir una segunda definición visual del QR.

## Pruebas

- Unitarias: ligas, contraste, nombres de archivos, límites de encuadre y relaciones entre estilos.
- Integración: salida SVG decodificada, interacción con el controlador, colores, logo, invalidación de comprobaciones, cuatro lecturas y formatos descargables.
- Worker: lectura real mediante el protocolo del worker, incluyendo buffers transferidos y trabajos simultáneos.

Los adaptadores de Canvas y DOM viven únicamente en `tests/helpers/`; no se incluyen en el bundle. Ejecuta `npm run check` y `npm run format:check` antes de publicar cambios. Revisa también escritorio y móvil en un navegador real cuando modifiques interfaz o animación.

## Publicar

Vercel usa `npm ci`, `npm run build` y `dist`. Los recursos en `public/` se copian directamente. El proyecto no requiere variables de entorno ni servicios externos. El dominio y las rutas de los metadatos sociales en `index.html` y `public/robots.txt` deben actualizarse juntos si cambia el dominio.

Nunca subas `node_modules/`, `dist/`, `.vercel/`, credenciales ni archivos `.env`. El lockfile sí se versiona para reproducir las dependencias.
