# Morphiq QRs

Estudio de códigos QR de **Morphiq**, desarrollado por **M1gu3hb**. Genera códigos estáticos que contienen directamente la liga elegida. La generación, la edición de imágenes, la comprobación y las exportaciones se ejecutan en el navegador.

**Sitio:** https://morphiqqr.vercel.app/  
**Marca:** https://morphiq.com.mx  
**Repositorio:** https://github.com/M1gu3hb/Morphiq-QRs

## Desarrollo

Requiere Node.js 22.12 o posterior y npm. Node.js 24 es la versión utilizada para validar el proyecto.

```sh
npm ci
npm run dev
```

Vite muestra la dirección del servidor local. Para obtener y revisar la versión de producción:

```sh
npm run build
npm run preview
```

El resultado está en `dist/`. No necesita un servidor de aplicación ni una base de datos. `vercel.json` contiene la configuración del proyecto para Vercel; no es necesario desplegar de nuevo para trabajar con este repositorio.

## Funciones

- Generación automática al pegar una liga; negro sobre blanco y margen de un módulo por defecto.
- 64 estilos predefinidos, 41 formas de módulos, 9 formas de esquinas y 7 centros, con restricciones de compatibilidad.
- Selector de color propio con área de saturación/brillo, tono, HEX y RGB.
- Imagen central con encuadre automático, recorte, zoom, posición X/Y, arrastre, integración y trama QR.
- Símbolo Morphiq recortado del recurso original y corrección de errores alta al activar una imagen.
- Descargas PNG, SVG, PDF vectorial, JPG y WebP.
- Comprobación mediante lectura real de cuatro variantes: original, reducción, rotación y compresión/desenfoque. La descarga requiere superar las cuatro lecturas y el control de contraste.
- Fondo ASCII animado, controles separados y metadatos para compartir el enlace.

La comprobación no garantiza la lectura en todos los dispositivos o condiciones de impresión. Los diseños extremos, las imágenes grandes y los márgenes pequeños pueden fallar; el comprobador propone ajustes. Para impresión, un margen de cuatro módulos ofrece una zona libre más adecuada, aunque el valor solicitado por defecto es uno.

## Estructura

| Ruta              | Responsabilidad                                           |
| ----------------- | --------------------------------------------------------- |
| `index.html`      | Interfaz, accesibilidad y metadatos sociales              |
| `src/app/`        | Inicio, valores por defecto y coordinación de la interfaz |
| `src/qr/`         | Codificación, catálogo y geometría visual compartida      |
| `src/image/`      | Carga, normalización, encuadre e integración de imágenes  |
| `src/validation/` | Pruebas de lectura y decodificador en un worker           |
| `src/export/`     | Exportadores SVG, imágenes rasterizadas y PDF             |
| `src/ui/`         | Galería, selector de colores, editor y notificaciones     |
| `src/styles/`     | Estilos separados por componente                          |
| `src/utils/`      | Contraste, nombres y descarga de archivos                 |
| `src/vendor/`     | Codificador QR vendorizado con su licencia original       |
| `public/`         | Recursos de marca, metadatos y motor del fondo ASCII      |
| `tests/`          | Pruebas unitarias y de integración con lectura real       |
| `docs/`           | Arquitectura, mantenimiento y créditos de terceros        |

## Comprobaciones

```sh
npm run check
npm run format:check
```

`check` ejecuta las pruebas unitarias, las pruebas de integración y la compilación. Las pruebas de integración usan Canvas, Sharp, jsQR y una representación del DOM; comprueban la salida real y las interacciones principales. No sustituyen una revisión visual en un navegador y en teléfonos.

GitHub Actions ejecuta las mismas comprobaciones en cada push y pull request de `main`.

Más información: [arquitectura](docs/architecture.md), [mantenimiento](docs/development.md) y [recursos de terceros](docs/third-party.md).
