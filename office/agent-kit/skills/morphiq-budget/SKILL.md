---
name: morphiq-budget
description: Controla presupuesto por misión y evita uso duplicado o reintentos sin límite.
---

El presupuesto global de oficina es $100 y el bootstrap completo como máximo $2. No compra créditos ni activa recargas. Antes de cada query el scheduler reserva su máximo en vuelo; no gasta automáticamente por abrir UI. Gasto es estimación del cliente, no factura ni saldo oficial. Tokens vienen del runtime y cache significa prompt caching del proveedor.

Deduplica assistant por message.id. Result y modelUsage son acumulados de sesión, incluyen subagentes; usage del bucle principal puede excluirlos. Diferencia resume, épocas de reset y queries independientes. No suma costo padre más subagentes nativos ni provisional más final. Crash, precio desconocido o uso incompleto queda pendiente de reconciliar con reserva retenida. Nunca supone cero. Máximo dos fallos por objetivo, espera por eventos, no polling pagado. Respeta Retry-After y límites compartidos. Las llamadas en vuelo pueden terminar después de cancelar. Saldo y fecha Console son entradas manuales; no inventes promoción ni renovación.
