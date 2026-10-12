# Morphiq Oficina

Oficina local de agentes para Morphiq QRs. Abre `scripts/start.ps1` en PowerShell o el acceso `Abrir Morphiq Oficina` de la carpeta de trabajo. El panel está en http://127.0.0.1:4310. Node 24 LTS es necesario.

Escribe una misión de investigación o diagnóstico, asigna presupuesto y pulsa **Ejecutar misión**. Opus 5.5 dirige; Haiku 5.5 implementa en fixtures o investiga y revisa en copias aisladas. El producto está en lectura. Ninguna misión se inicia al abrir la oficina. La rama `oficina` contiene la infraestructura; `main` conserva el QR.

```powershell
cd office
npm ci
npm run doctor
npm run build
./scripts/create-shortcut.ps1
./scripts/start.ps1
npm run status
npm run test
npm run test:ui
npm run export-run -- <id>
npm run stop
```

La clave vive exclusivamente en `MORPHIQ_ROOT/secrets/office.env`. El runner carga ese archivo antes de usar el SDK; el navegador recibe un secreto de control temporal diferente. Mantiene `127.0.0.1`, valida Host/Origin y no tiene shell genérica. No añadas variables `VITE_` con claves. Una clave API no transfiere credenciales GitHub ni skills personales.

Las skills comunes están en `agent-kit`. Se cargan como plugin local con `settingSources: []`; `agents/roles.json` limita cuáles puede invocar cada perfil. Las políticas Morphiq se precargan en el prompt y las demás se invocan bajo demanda con `Skill`. Los eventos muestran invocaciones y capacidades reales. Solo se ofrece `Skill` como herramienta nativa; lectura, escritura acotada, checks y coordinación usan MCP tipado. Ni director ni revisores pueden escribir; ningún trabajador puede delegar.

SQLite y sesiones quedan fuera del repositorio. Pausar termina llamadas en vuelo y evita nuevos trabajos; cancelar aborta queries y procesos propios. Al reiniciar, los trabajos parciales se bloquean y las misiones se pausan. No se repiten comandos inciertos. La oficina comprueba PID, ejecutable y fecha de creación de procesos sobrevivientes antes de permitir repetirlos o cancelarlos. Los worktrees fallidos y conflictos se conservan.

Cada query reserva presupuesto antes de arrancar. `maxBudgetUsd`, turnos y timeout acotan el runtime; el scheduler no agrega reintentos automáticos encima de los del SDK. Un objetivo recibe hasta dos intentos Haiku antes de volver a Opus; objetivos reducidos conservan el historial. El ledger deduplica `message.id`, acumula deltas de sesión/resume/reset y cuenta queries independientes aparte. `modelUsage` incluye auxiliares nativos; no se suman otra vez.

El coste del SDK es una estimación. Saldo y vencimiento oficial se introducen manualmente desde [Claude Console](https://platform.claude.com/). Allí puede fijarse el spend limit del workspace. Una query interrumpida conserva su reserva hasta reconciliar su coste: no se supone que sea gratis. [Documentación de contabilidad](https://code.claude.com/docs/en/agent-sdk/cost-tracking).

Presupuesto de oficina: $100. Bootstrap global: $2. En Configuración se ajustan concurrencia, alerta de presupuesto y ventana de historial. **Cancelar todo** aborta las misiones pendientes y conserva evidencia y reservas que necesiten reconciliación. `npm run smoke` reutiliza el informe existente sin gastar de nuevo; `npm run smoke -- --new` inicia otra comprobación dentro del saldo del límite de bootstrap. Los fixtures no se publican ni modifican el QR.

Para una misión futura de producto se requiere habilitar `MORPHIQ_PRODUCT_WRITE_ENABLED=true` en el archivo local **y** autorizar esa misión mediante el contrato API `authorizeProductWrite`. No hay un botón para escribir el QR en esta etapa. El integrador usa main dedicado, lock, base/HEAD, revisión independiente, checks y un commit final de M1gu3hb. El push normal de main solo pertenece a una misión autorizada. Ante conflictos o pruebas fallidas, conserva los cambios y exige resolución y nueva verificación; nunca ejecuta reset/clean/force push.

Consulta [arquitectura](docs/architecture.md), [aceptación](docs/acceptance.md), [rutas](docs/paths.md), [Android pendiente](docs/android.md) y [avisos de terceros](THIRD_PARTY_NOTICES.md).
