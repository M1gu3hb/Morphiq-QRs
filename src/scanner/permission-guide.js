export function initPermissionGuide(el) {
  const hostname = location.hostname;
  const guides = {
    android: {
      steps: [
        'En el aviso del navegador, elige «Permitir mientras visitas el sitio» o «Permitir». Si Android pregunta, elige «Mientras se usa la app».',
        `En Chrome: Configuración → Configuración de sitios → Cámara. Busca ${hostname} y permite la cámara.`,
        'Si sigue bloqueada: Ajustes del teléfono → Apps → Chrome (o Morphiq QR, si aparece) → Permisos → Cámara → Mientras se usa la app.',
      ],
      note: 'Evita «Solo esta vez» y «Preguntar siempre» para conservar el permiso. Los nombres varían según tu teléfono.',
      help: 'https://support.google.com/chrome/answer/2693767?hl=es&co=GENIE.Platform%3DAndroid',
    },
    ios: {
      steps: [
        `Abre ${hostname} en Safari y entra al lector. Permite la cámara cuando se solicite.`,
        'En el menú de la página de Safari, abre Más → Configuración del sitio web → Cámara y selecciona Permitir, si está disponible.',
        'Vuelve a Morphiq QR. Si la app instalada mantiene un permiso independiente, permite la cámara también en ella.',
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
  platform.value = /Android/.test(navigator.userAgent)
    ? 'android'
    : /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'ios'
      : 'desktop';
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
  }
  platform.addEventListener('change', render);
  render();
}
