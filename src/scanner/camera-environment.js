export function cameraEnvironment() {
  const agent = navigator.userAgent || '';
  const ios =
    /iPad|iPhone|iPod/.test(agent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const browser = /SamsungBrowser/.test(agent)
    ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(agent)
      ? 'Firefox'
      : /Edg/.test(agent)
        ? 'Edge'
        : /OPR|Opera/.test(agent)
          ? 'Opera'
          : /MiuiBrowser/.test(agent)
            ? 'Mi Browser'
            : /Chrome|CriOS/.test(agent)
              ? 'Chrome'
              : /Safari/.test(agent)
                ? 'Safari'
                : 'tu navegador';
  const policy = document.permissionsPolicy || document.featurePolicy;
  let allowed = true;
  try {
    allowed = policy?.allowsFeature?.('camera') !== false;
  } catch {
    /* Older shells. */
  }
  return {
    browser,
    platform: ios ? 'ios' : /Android/.test(agent) ? 'android' : 'desktop',
    installed:
      window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    embedded: /\bwv\b|FBAN|FBAV|Instagram|Line\//.test(agent),
    secure: window.isSecureContext,
    supported: typeof navigator.mediaDevices?.getUserMedia === 'function',
    allowed,
  };
}

export function cameraProblem(error, { acquired = false } = {}) {
  const environment = cameraEnvironment();
  if (!environment.secure)
    return {
      title: 'Abre la versión segura',
      message:
        'La cámara necesita una conexión HTTPS. Abre el lector en tu navegador o fotografía el QR.',
    };
  if (!environment.allowed)
    return {
      title: 'Abre el lector directamente',
      message:
        'La página que contiene este lector bloquea la cámara. Ábrelo en una pestaña del navegador.',
    };
  if (!environment.supported || environment.embedded)
    return {
      title: 'Usa el navegador del teléfono',
      message:
        'Este navegador no ofrece acceso completo a la cámara. Abre el lector en Chrome o Safari, o fotografía el QR.',
    };
  const name = error?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return acquired
      ? {
          title: 'Toca para iniciar la cámara',
          message:
            'El permiso se concedió, pero el video necesita un toque. Pulsa «Activar cámara».',
        }
      : {
          title: 'La cámara necesita autorización',
          message:
            'Permite la cámara al tocar «Activar cámara». Si no aparece un aviso, usa «Permisos» o fotografía el QR.',
        };
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return {
      title: 'No se encontró una cámara',
      message: 'Puedes leer el QR desde una fotografía o una imagen guardada.',
    };
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return {
      title: 'La cámara no está disponible',
      message:
        'La cámara puede estar ocupada o desactivada. Cierra otras apps, revisa el acceso a cámara del teléfono y vuelve a intentarlo.',
    };
  return {
    title: 'No se pudo iniciar la cámara',
    message:
      'Vuelve a intentar con «Activar cámara», abre el lector en tu navegador o fotografía el QR.',
  };
}

export async function requestCamera(facing, isCurrent) {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
      audio: false,
    });
  } catch (error) {
    // Retry only a constraints failure, never a denial or a busy/disabled camera.
    if (
      !isCurrent() ||
      !['OverconstrainedError', 'ConstraintNotSatisfiedError', 'TypeError'].includes(error.name)
    )
      throw error;
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}
