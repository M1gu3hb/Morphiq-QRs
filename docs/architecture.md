# Arquitectura

La aplicación usa JavaScript con módulos ES y Vite. Los módulos de generación y geometría no dependen del DOM. `createStudio()` mantiene el estado de una instancia y conecta los controles con esos módulos; no expone estado global.

## Recorrido de un diseño

1. `normalizeLink()` acepta HTTP/HTTPS y agrega HTTPS cuando se pega un dominio sin protocolo.
2. `encodeLink()` genera la matriz QR. Una imagen activa fuerza corrección H y versión mínima 3.
3. `renderQrSvg()` compone la geometría, los colores y la imagen en un SVG. El preview, la lectura y las exportaciones rasterizadas utilizan ese resultado.
4. `QRCheck.run()` decodifica cuatro variantes y compara cada lectura con la liga completa. Cambiar el diseño invalida el resultado anterior.
5. El exportador elegido crea un Blob local y `saveFile()` inicia su descarga. El PDF mantiene los módulos como vectores e incorpora una imagen de la composición central cuando existe.

La matriz codifica la dirección del usuario. No hay redirecciones intermedias, cuentas, caducidad, solicitudes a una API de generación ni backend. Las dependencias se empaquetan con la aplicación; las imágenes seleccionadas no se envían a un servicio.

## Geometría

`src/qr/styles.js` reúne el catálogo, la compatibilidad entre esquinas y centros, y los trazados compartidos por SVG y PDF. Los patrones de sincronización, alineación y metadatos conservan módulos rectos. `src/image/framing.js` impide que la imagen cubra los patrones estructurales.

El tamaño del área central y el zoom son parámetros independientes. La imagen se recorta dentro de una ventana fija. El encuadre automático usa contain para imágenes transparentes o con un borde uniforme y cover para fotografías. La normalización recorta el relleno exterior sin eliminar colores del interior.

## Comprobador

`decoder-client.js` crea un worker solo al comprobar. El worker recibe un buffer de píxeles por transferencia y devuelve el texto leído por jsQR. Cuando Worker no está disponible, el cliente carga el mismo decodificador en el hilo principal. Cada solicitud tiene identificador y tiempo límite.

El controlador usa una revisión del diseño y un token de comprobación para descartar resultados antiguos. Los controles se bloquean durante una exportación para que el archivo coincida con el diseño comprobado. Las cuatro pruebas son comprobaciones digitales; no representan todos los lectores ni todos los daños físicos posibles.

## Recursos

El motor GLYPHOS está aislado en `public/vendor/glyphos-field.js`. El logo, la imagen social y los fondos originales se conservan en `public/assets/`. Algunos fondos de versiones anteriores se mantienen como recursos del proyecto, aunque el fondo actual se genera animado.

No se cambió el sitio de producción al organizar este repositorio. La configuración de Vercel permite compilar esta estructura en un despliegue futuro.
