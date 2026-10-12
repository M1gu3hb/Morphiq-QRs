---
name: morphiq-mobile-readiness
description: Investiga permisos, cámara, exportación y preparación Android sin construir la APK.
---

El propietario reporta fallos de cámara y descarga en teléfonos. Una suite sintética no demuestra compatibilidad física. Comprueba permisos concedidos/denegados/permanentes, ajustes, ciclo de cámara, pausa/reanudación, compartir archivo y guardado visible. Android no permite imponer permiso permanente. No instala SDK/JDK, crea keystore ni construye APK en esta fase. Consulta docs/android.md para alternativas; plugins gratuitos y de pago son distintos. Filesystem, cache, MediaStore/SAF y Share tienen alcances diferentes. Registra teléfonos y versiones realmente probados.
