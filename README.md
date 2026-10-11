# Morphiq QRs

Estudio de códigos QR de **Morphiq**, desarrollado por **M1gu3hb**. Crea, personaliza, comprueba y lee códigos estáticos directamente en el navegador.

**Sitio:** https://morphiqqr.vercel.app/  
**Marca:** https://morphiq.com.mx  
**Repositorio:** https://github.com/M1gu3hb/Morphiq-QRs

## Desarrollo

Requiere Node.js 22.12 o posterior y npm. Node.js 24 se utiliza en las comprobaciones del proyecto.

```sh
npm ci
npm run dev
```

Para compilar y revisar la versión de producción:

```sh
npm run build
npm run preview
```

Vite genera `dist/`; el script posterior crea el service worker con un hash del contenido compilado. No se requieren variables de entorno, un backend ni cuentas de usuarios. `vercel.json` permite desplegar el proyecto en Vercel.

## Funciones

- **13 contenidos:** liga, WhatsApp con mensaje, Wi-Fi, contacto vCard, teléfono, correo, evento de calendario, Spotify, red social, aplicación, ubicación, texto y SMS.
- **Diseño:** 32 combinaciones, 18 módulos principalmente conectados, 9 esquinas y 7 centros compatibles. Las muestras codifican `https://morphiq.com.mx`.
- **Colores:** selector propio con saturación, brillo, tono, HEX y RGB; 8 paletas; tinta sólida, degradado lineal/radial y dúo tono con dirección editable.
- **Imagen:** PNG/JPG/WebP y SVG sanitizado, recorte automático, área por módulos completos, zoom independiente, desplazamiento X/Y continuo, arrastre, base de color y eliminación de fondo uniforme con restauración. El editor aparece únicamente con una imagen activa.
- **Integración:** imagen central, trama QR, textura dentro de módulos y fotografía de fondo. Símbolo Morphiq y 9 símbolos populares a color listos para usar.
- **Marcos:** 43 opciones disponibles en el editor normal, organizadas por familias. Muestras reales, hasta tres campos de texto independientes, saltos de línea, tipografías, colores y degradados editables, además de mezcla independiente de formas y paletas. [Correspondencia de referencias](docs/frame-references.md).
- **Siluetas PNG:** contorno con trama decorativa y un QR completo dentro de una zona interior opaca. Al elegir una silueta, el margen pasa a cero y se desactiva el marco. Conserva la matriz completa; no deforma ni redistribuye los datos del QR.
- **Proyectos:** autoguardado y hasta 100 proyectos locales en IndexedDB; exportación/importación JSON para respaldarlos o transferirlos.
- **Estudio:** comparación A/B, mezcla general o por elemento y reparación asistida que presenta una variante comprobada antes de aplicarla. Las sugerencias se pueden cerrar y las reparaciones se pueden deshacer conservando cambios posteriores de contenido. Vista previa flotante ampliable y minimizable al recorrer los controles.
- **Impresión:** ancho físico de 15–200 mm, 300/600 dpi, medidas proporcionales, densidad PNG/JPG, SVG con medidas en milímetros, PDF y etiquetas A4.
- **Lotes:** hasta 100 QRs por ligas o CSV; salida ZIP en PNG/SVG/PDF, con cuatro lecturas por elemento y un reporte de archivos válidos y omitidos.
- **Descargas:** PNG, SVG, PDF, JPG y WebP. Los módulos y marcos permanecen vectoriales en SVG/PDF; las fotografías se conservan como imágenes integradas.
- **Lector:** cámara a pantalla completa, cambio de cámara, linterna cuando el dispositivo la permite y lectura de imágenes. Al detectar, marca el código, apaga la cámara y reconstruye un QR completo con el contenido exacto. Permite compartir el PNG, copiar información, abrir enlaces, llamar, escribir mensajes o guardar contactos/eventos mediante acciones explícitas. No abre enlaces automáticamente.
- **Cámara automática:** se inicia al entrar al lector y se reanuda al volver a la app cuando el permiso sigue concedido. Una parada manual, un resultado reconocido o la lectura de una imagen suspenden la reanudación. Incluye preferencia local para desactivar el arranque y guía de permisos para Android, iPhone/iPad y computadora. Un rechazo no vuelve a solicitarse automáticamente; los permisos permanentes los gestiona el navegador.
- **Compartir QR:** disponible en generador y lector. Envía únicamente el archivo PNG mediante el menú nativo; no añade texto, título ni URL. Si el navegador no comparte archivos, guarda el PNG para adjuntarlo manualmente. El generador comprueba cuatro lecturas antes de compartir.
- **PWA:** mismo nombre e icono azul. En navegador abre el generador; instalada abre el lector. Tras la primera carga completa, generación, lectura de imágenes y exportadores funcionan sin conexión.
- Fondo ASCII animado, tarjetas independientes, expandidores fluidos, interfaz adaptable y metadatos de imagen para compartir.

Las herramientas de estudio son opcionales. El inicio conserva negro sobre blanco y margen de un módulo. Activar una imagen fuerza resistencia H. Activar impresión ajusta el margen a cuatro módulos si era menor.

## Lectura y datos locales

La descarga individual exige cuatro lecturas reales: original, tamaño reducido, rotación y compresión/desenfoque. Se comparan con el contenido completo y se verifica el contraste. Los lotes omiten los diseños que no pasan; la reparación nunca se aplica automáticamente.

Estas pruebas digitales no garantizan lectura en todos los teléfonos o condiciones físicas. Una silueta estrecha, una imagen grande o un diseño extremo pueden necesitar ajustes. Los patrones de posición, sincronización, alineación y metadatos del QR se preservan.

Los QRs contienen directamente el contenido elegido: no hay redirección de Morphiq, caducidad, seguimiento ni cobros. Las etiquetas de campaña añaden parámetros UTM a la liga original; no cuentan visitas ni implican un QR dinámico. El destino necesita conexión cuando es un sitio web.

Proyectos, imágenes y contraseñas Wi-Fi permanecen en el navegador y no se envían a una API. El almacenamiento local no sincroniza dispositivos y puede borrarse al limpiar los datos del navegador; exporta los proyectos que quieras conservar. La cámara necesita HTTPS o localhost y permiso del usuario.

## Estructura

| Ruta                       | Responsabilidad                                           |
| -------------------------- | --------------------------------------------------------- |
| `src/app/`                 | Estado del generador, valores iniciales y coordinación    |
| `src/content/`             | Formularios y codificación de contenidos directos         |
| `src/qr/`                  | Matriz, catálogo, trazados y efectos de tinta             |
| `src/frames/`              | Marcos vectoriales y composición de textos                |
| `src/image/`               | Normalización, vectores, encuadre, textura y siluetas     |
| `src/validation/`          | Comprobaciones y decodificador en un worker               |
| `src/export/`              | SVG, raster, metadatos de impresión y PDF                 |
| `src/projects/`            | Estado validado, IndexedDB y respaldos                    |
| `src/scanner/`             | Cámara, detección y acciones del contenido leído          |
| `src/advanced/`            | Paletas, mezcla, comparación, reparación y lotes          |
| `src/pwa/`, `scripts/`     | Instalación y compilación del service worker              |
| `src/ui/`, `src/styles/`   | Controles, galerías, animación y estilos                  |
| `src/vendor/`, `licenses/` | Codificador y avisos de terceros                          |
| `public/`                  | Marca, iconos, manifiesto, metadatos y motor ASCII        |
| `tests/`, `docs/`          | Pruebas unitarias, integración, navegador y mantenimiento |

## Comprobaciones

```sh
npm run check
npm run format:check
npx playwright install chromium
npm run test:e2e
```

`check` ejecuta pruebas unitarias, integración y compilación. Las pruebas de navegador comprueban los 13 formularios, autoguardado y respaldos, edición por módulos, reparación sugerida, PDF legible, densidad de impresión, lotes, compartir PNG, permisos de cámara, móvil vertical/horizontal y PWA/lector sin conexión. Para esas pruebas se requiere Poppler (`pdftoppm`) en el sistema. Un Chromium ya instalado puede indicarse mediante `MORPHIQ_BROWSER_EXECUTABLE`.

GitHub Actions ejecuta las comprobaciones en cada push y pull request de `main`.

Más información: [arquitectura](docs/architecture.md), [mantenimiento](docs/development.md) y [recursos de terceros](docs/third-party.md).
