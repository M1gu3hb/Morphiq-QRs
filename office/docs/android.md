# Android: misión pendiente

No se construyó APK ni se instaló el toolchain. Cámara y descargas presentan problemas en algunos teléfonos según el propietario; no hay evidencia de pruebas físicas de esta oficina. El perfil móvil y su skill están preparados para una misión posterior.

Evaluar [Capacitor](https://github.com/ionic-team/capacitor). El [scanner oficial](https://capacitorjs.com/docs/apis/barcode-scanner) requiere minSdk 26 y ofrece scanBarcode. Añadir Camera para tomar fotos no implementa un lector continuo.

El paquete abierto [@capacitor-mlkit/barcode-scanning](https://github.com/capawesome-team/capacitor-mlkit) ofrece [startScan/eventos y scan](https://capawesome.io/docs/sdks/capacitor/mlkit/barcode-scanning/). Para UI propia, estudiar cámara nativa y WebView transparente; verificar modelo incluido/descargado, Google Play Services y offline. No confundirlo con barcode-scanner de Capawesome Insiders, oferta distinta de pago. Versión de Capacitor, minSdk y fabricantes deben verificarse al elegirlo.

[Filesystem](https://capacitorjs.com/docs/apis/filesystem) no equivale a guardar automáticamente en cualquier carpeta pública. Una exportación futura debe decidir MediaStore/SAF, MIME, nombre, URI y cancelación. [Share](https://capacitorjs.com/docs/apis/share) comparte por defecto archivos de cache Android; cambiar ubicación requiere revisar FileProvider.

Matriz pendiente: primera autorización, permiso concedido, denegado y permanente; ajustes y regreso; cámara ocupada; pausa/reanudación; pantalla completa; payload exacto y QR regenerado; copiar/abrir por acción explícita; compartir solo PNG; todos los formatos reales; guardado visible y cancelación; fabricantes/Android soportados; dispositivo sin servicios Google cuando la biblioteca lo permita; offline y pérdida de proceso. El sistema no permite imponer “permitir para siempre”. iOS necesita toolchain Apple.
