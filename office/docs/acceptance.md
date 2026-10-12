# Evidencia y límites

Tres pruebas reales en fixtures independientes del QR. Cada una tuvo tres intervenciones Opus 5.5, dos workers Haiku 5.5 en copias detached, dos revisores independientes, uso real de Skill/MCP y verificación conjunta con dos tests verdes. No se hizo push de los fixtures.

| Fixture                 | Commit integrado                         | Coste estimado cerrado (USD) |
| ----------------------- | ---------------------------------------- | ---------------------------- |
| bootstrap-1791767211963 | e694e4aeb7e480752e6d318df57e3d1695bc7f9f | 0.13268917                   |
| bootstrap-1791769077475 | d038935b975b1ca8ea2173adb307108fb199b944 | 0.14374431                   |
| bootstrap-1791769253104 | 42fd2f2632721cc2dc51fe9e417b9b1afbef8ad7 | 0.13455327                   |

Total bootstrap: **$0.41098675**, reservas 0, queries sin reconciliar 0, agentes activos 0. La última prueba expuso una revisión bloqueada por contexto anterior al commit del runner; inspect_git permitió verificar HEAD/autor/diff y la revisión reintentada aprobó. El historial se conserva y el fallo tiene prueba de regresión. Los permisos del SDK registran la decisión efectiva sin reglas allowedTools que oculten el callback.

Evidencia detallada fuera de Git: reports/smoke.json, base SQLite, logs de checks y capturas office-desktop.png/office-mobile.png. Solo modelos exactos pedidos; auxiliares nativos reportados en modelUsage se cuentan una vez. Las pruebas unitarias usan fixtures explícitos y no gastan API. El smoke es operativo, no un modo de demo.

Comprobaciones de oficina: lint, typecheck, build, audit npm sin vulnerabilidades, 20 pruebas de infraestructura y 8 de interfaz. Cubren presupuesto/concurrencia/dependencias, deduplicación, resume/reset/subagentes, crash parcial, scope/redacción, leases/reinicio, pausa/cancelación y descendientes, HTTP/Origin/secreto local, sin clave, Git con HEAD cambiado/conflicto, skills completas y recuperación de revisión. UI con teclado/móvil/reduced motion, viewport CSS equivalente al zoom 200%, inspector real, exportaciones JSON/CSV y ocho avatares activos de un fixture de UI aislado con panel usable. Estos tests no ejecutan misiones ni gastan API. Informes: reports/office-check.txt y reports/ui-check.txt.

Arranque oculto probado desde Iniciar-Oficina.ps1 y acceso .lnk creado en D:. Tras varios reinicios el coste, los commits y las tareas terminadas permanecieron iguales; no se repitieron llamadas. Comandos doctor, status, stop, start, export-run, test y smoke comprobados.

QR importado en lectura: main 9df73b77e5b8479dca802a1544679f04382140e3, v2.2.2. Pasan 12 unitarias y 17 de integración. Vite compila; el paso build-pwa.js falla en Windows por construir D:\\D:\\MIS%20PROYECTOS... desde URL de archivo. Informe: reports/qr-baseline.txt. No se modifica este problema ni ningún archivo del producto. No se ejecutaron las pruebas e2e del QR después del fallo de build y no se probó cámara en teléfonos físicos.

La API administrativa y los límites completos de cuenta no se pueden inferir de una clave normal; se usa saldo/fecha manual y se muestran retries/errores reales. No se asume que el presupuesto local sea un candado exacto de facturación. Las llamadas en vuelo pueden terminar al cancelar.

Misiones de escritura del QR, resolución arquitectónica de conflictos, APK, nuevos módulos y despliegues públicos quedan pendientes de encargos posteriores. Sus perfiles, checkout, contratos y locks están preparados; no se declara haber ejecutado esas misiones. No se publican secretos, SQLite, sesiones, clones ni capturas grandes en el repositorio.
