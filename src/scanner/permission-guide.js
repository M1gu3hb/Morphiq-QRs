import { cameraEnvironment } from './camera-environment.js';

export function initPermissionGuide(el) {
  const hostname = location.hostname;
  const environment = cameraEnvironment();
  const browser =
    environment.browser === 'tu navegador'
      ? 'el navegador que instaló la app'
      : environment.browser;
  const reader = new URL('/?view=scan', location.href);
  if (!environment.secure) reader.protocol = 'https:';
  for (const id of ['camera-browser-open', 'camera-guide-open']) el(id).href = reader.href;
  el('camera-guide-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reader.href);
      el('camera-guide-copy').textContent = 'Enlace copiado';
    } catch {
      const link = el('camera-reader-link');
      link.value = reader.href;
      link.hidden = false;
      link.focus();
      link.select();
      el('camera-guide-note').textContent =
        'El enlace está seleccionado. Mantén pulsado y elige «Copiar», o usa Ctrl/Cmd+C. Después ábrelo en tu navegador.';
    }
  });
  const guides = {
    android: {
      steps: [
        'Toca «Activar cámara». En el aviso elige «Permitir» o «Permitir mientras visitas el sitio». Si Android pregunta, elige «Mientras se usa la app».',
        `Abre el lector en ${browser}. En Chrome: ⋮ → Configuración → Configuración de sitios → Cámara. Activa la solicitud de cámara y, si ${hostname} aparece bloqueado, cámbialo a Permitir. En otros navegadores, busca Permisos de sitios → Cámara.`,
        `Si la app no muestra Cámara y solo aparece Notificaciones, revisa Ajustes del teléfono → Apps → ${browser} → Permisos → Cámara. Si no aparece allí, primero toca «Activar cámara» en la página abierta en ese navegador.`,
        'Comprueba que el acceso a cámara del teléfono esté encendido en los ajustes rápidos o de privacidad. Cierra otras apps que usen la cámara y vuelve a intentar.',
      ],
      note: 'Evita «Solo esta vez» y «Preguntar siempre» para conservar el permiso. Los nombres varían según tu teléfono.',
      help: 'https://support.google.com/chrome/answer/2693767?hl=es&co=GENIE.Platform%3DAndroid',
    },
    ios: {
      steps: [
        `Usa «Abrir lector en navegador» o copia su enlace y ábrelo en Safari. Toca «Activar cámara» y permite el acceso.`,
        'En el menú de la página de Safari, abre Más → Configuración del sitio web → Cámara y selecciona Permitir, si está disponible.',
        'En Ajustes → Apps → Safari → Cámara, permite que el navegador pregunte. Si usas Chrome, revisa también Ajustes → Apps → Chrome → Cámara, cuando esa opción esté disponible.',
        'Vuelve a Morphiq QR y toca «Activar cámara». La app instalada puede pedir un permiso independiente. Si no aparece el aviso, usa «Fotografiar QR» o el lector abierto en Safari.',
      ],
      note: 'Safari y la app instalada pueden gestionar permisos por separado. La opción de recordarlos depende de tu versión de iOS.',
      help: 'https://support.apple.com/es-es/guide/iphone/iphb3100d149/ios',
    },
    desktop: {
      steps: [
        'Cuando se solicite, elige «Permitir mientras visitas el sitio» o la opción de recordar el permiso.',
        `Abre los ajustes del sitio junto a la dirección ${hostname}. Cambia Cámara a Permitir.`,
        'Si sigue bloqueada, permite la cámara para tu navegador en los ajustes de privacidad del sistema.',
      ],
      note: 'No elijas «Solo esta vez» si quieres conservar el permiso. En navegación privada puede no guardarse.',
      help: 'https://support.google.com/chrome/answer/2693767?hl=es',
    },
  };
  const platform = el('camera-guide-platform');
  platform.value = environment.platform;
  function render() {
    const guide = guides[platform.value];
    el('camera-guide-steps').replaceChildren(
      ...guide.steps.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
    el('camera-guide-note').textContent = guide.note;
    el('camera-guide-help').href = guide.help;
    el('camera-guide-installed').textContent =
      platform.value === 'android'
        ? 'Una PWA puede mostrar solo Notificaciones en los permisos de la app. La autorización de cámara también depende del navegador y del permiso del sitio; no necesitas encontrar una opción Cámara dentro de Morphiq QR.'
        : platform.value === 'ios'
          ? 'En iPhone, los permisos de Safari y de la app instalada pueden ser distintos. La app no puede cambiar los ajustes del sistema por ti.'
          : 'Revisa tanto el permiso del sitio como el permiso de cámara del navegador en tu sistema.';
  }
  platform.addEventListener('change', render);
  render();
}
