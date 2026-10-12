# Rutas verificadas

Raíz: `D:/MIS PROYECTOS/Morphiq Oficina`.

| Contenido                       | Ruta relativa a la raíz  |
| ------------------------------- | ------------------------ |
| Código oficina/QR rama oficina  | repos/Morphiq-QRs/office |
| Checkout main de integración    | workspaces/qr-main       |
| Copias detached por tarea       | worktrees                |
| Siete clones upstream completos | references               |
| SQLite, lock, recibos           | state                    |
| Configuración/sesiones del SDK  | state/claude             |
| npm cache                       | cache/npm                |
| npm prefix gestionado           | tools/npm                |
| Chromium/FFmpeg de Playwright   | cache/playwright         |
| Temporales de procesos          | temp                     |
| Informes, logs y capturas       | reports                  |
| Clave privada                   | secrets/office.env       |

`start.ps1` establece estas variables solo para sus procesos. `processEnv` conserva PATH y el entorno de Windows, quita credenciales de checks y añade explícitamente la clave al runtime SDK. No redefine HOME, USERPROFILE ni CODEX_HOME. La configuración vigente `CLAUDE_CONFIG_DIR` fue comprobada en los tipos y runtime instalados; el smoke real creó projects, sessions, plugins y backups en state/claude. El ejecutable nativo está en office/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe.

Node, Git, gh y 21st ya estaban instalados en C:; no se reinstalaron. Windows, el navegador del propietario y Codex pueden escribir sus propios datos en C:. Fuentes, clones, módulos, builds, datos, caches y navegadores que administra esta oficina están en D:. No se cambiaron temporales globales del sistema.

El doctor inicial confirmó Windows 10 x64, Node 24.16.0, Git 2.54.0, gh con M1gu3hb, escritura en la raíz y unos 74 GB libres. `npm run doctor` actualiza reports/doctor.json con rutas y disponibilidad real, sin imprimir la clave.
