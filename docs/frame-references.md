# Marcos y referencias

El catálogo contiene 43 marcos vectoriales. Se accede a él desde **Marcos** en el editor normal; no requiere activar las herramientas de estudio. La galería permite buscar y filtrar por familias. La muestra de cada opción contiene un QR de `https://morphiq.com.mx`.

Cada motivo se reconstruye con SVG propio. Las variaciones de tinta, color de fondo, color del texto, tipografía y degradado se editan sobre la misma geometría. Las planchas de referencia no forman parte de los archivos publicados.

## Correspondencia de motivos

| Referencia                                         | Motivos incorporados                                                                                                                         | Identificadores                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `drhtegyyalssgg8ks.webp`                           | Bandas con QR y llamada inferior; colores de contenido editables                                                                             | `band`, `rounded`, `top`                                                                    |
| `images.jpeg`, primera fila                        | Banner con teléfono y dos textos; llamada lateral junto a teléfono; etiqueta separada inferior; tarjeta llena con panel QR; pestaña superior | `banner-phone`, `phone-side`, `label-bottom`, `band`, `tab-top`                             |
| `images.jpeg`, segunda fila                        | Banner compacto; visor con llamada lateral; teléfono alto; tarjeta con firma inferior; cabecera clara y cuerpo de contraste                  | `banner-compact`, `brackets-side`, `phone-outline`, `scan-label-outline`, `inverse-caption` |
| `images.jpeg`, tercera fila                        | Pastilla alargada lateral; escudo con visor; contorno sencillo; pastilla inferior; escudo de contorno                                        | `pill-side`, `shield-label`, `outline`, `label-pill`, `shield-outline`                      |
| `qr-code-design-template-vector.jpg`, primera fila | Sello ondulado; editorial vertical con tres textos; llamada grande en dos líneas; boleto lateral perforado                                   | `wave-stamp`, `discover-portrait`, `scan-bold`, `ticket-wide`                               |
| `qr-code-design-template-vector.jpg`, segunda fila | Marcador largo con QR circular; flecha curva; editorial horizontal con tres textos; globo superior derecho                                   | `bookmark-circle`, `arrow-curved`, `discover-landscape`, `bubble-top-right`                 |
| `qr-code-design-template-vector.jpg`, tercera fila | Globo inferior; globo superior izquierdo; etiqueta con doble flecha y teléfono; globo de contorno completo                                   | `bubble-bottom`, `bubble-top-left`, `label-pointer`, `bubble-outline`                       |
| `qr-code-designsjpg_800_46.jpeg`                   | Bandas de colores; círculo con sombra larga; círculo con borde punteado; contorno orgánico; banda ondulada con degradado                     | `band`, `rounded`, `circle-shadow`, `circle-dots`, `organic`, `wave-gradient`               |
| Referencia azul con visor de esquinas              | Esquinas abiertas con módulos conectados                                                                                                     | `corners` y módulos conectados del catálogo QR                                              |

Las otras tres referencias contienen formas o tratamientos del propio QR: mariposa, imágenes integradas y módulos redondos/conectados. Esas opciones corresponden a **Silueta PNG**, **Imagen** y **Diseño del QR**, respectivamente. Se mantiene un QR íntegro en la silueta y se preservan los patrones funcionales al integrar una imagen; no se añaden falsos marcadores de posición.

## Campos de texto

`discover-portrait` y `discover-landscape` tienen llamada principal, nombre/código y descripción inferior independientes. `banner-phone`, `banner-compact`, `phone-side`, `brackets-side` y `circle-shadow` tienen dos campos. Todos los demás tienen un campo principal, con saltos de línea cuando su composición los admite. Se puede dejar vacío cualquier campo para quitarlo.

El marco se compone en coordenadas proporcionales a la matriz original. El QR mantiene su aspecto cuadrado dentro de una salida que puede ser vertical u horizontal. PNG, SVG y PDF exportan el marco completo, los textos editados y sus colores. Las cuatro pruebas de lectura se ejecutan sobre la composición final, no sobre un QR sin marco.
