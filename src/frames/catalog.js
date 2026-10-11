const entries = [
  ['band', 'Banda inferior', 'Etiquetas'],
  ['top', 'Cabecera', 'Etiquetas'],
  ['outline', 'Contorno recto', 'Esenciales'],
  ['corners', 'Visor de esquinas', 'Esenciales'],
  ['ticket', 'Boleto vertical', 'Boletos'],
  ['ribbon', 'Listón en punta', 'Sellos'],
  ['speech', 'Globo sólido', 'Globos'],
  ['circle', 'Órbita', 'Círculos'],
  ['side', 'Texto vertical', 'Laterales'],
  ['badge', 'Insignia', 'Sellos'],
  ['notch', 'Etiqueta biselada', 'Etiquetas'],
  ['minimal', 'Línea editorial', 'Esenciales'],
  ['double', 'Doble contorno', 'Esenciales'],
  ['rounded', 'Tarjeta redonda', 'Tarjetas'],
  ['wave-stamp', 'Sello ondulado', 'Sellos'],
  ['discover-portrait', 'Tarjeta editorial vertical', 'Tarjetas', 3],
  ['scan-bold', 'Llamada en dos líneas', 'Tarjetas'],
  ['ticket-wide', 'Boleto perforado lateral', 'Boletos'],
  ['bookmark-circle', 'Marcador circular', 'Sellos'],
  ['arrow-curved', 'Flecha envolvente', 'Flechas'],
  ['discover-landscape', 'Tarjeta editorial horizontal', 'Tarjetas', 3],
  ['bubble-top-right', 'Globo superior derecho', 'Globos'],
  ['bubble-bottom', 'Globo inferior', 'Globos'],
  ['bubble-top-left', 'Globo superior izquierdo', 'Globos'],
  ['label-pointer', 'Etiqueta con flechas', 'Flechas'],
  ['bubble-outline', 'Globo de contorno', 'Globos'],
  ['banner-phone', 'Banner con teléfono', 'Dispositivos', 2],
  ['phone-side', 'Teléfono con llamada lateral', 'Dispositivos', 2],
  ['label-bottom', 'Etiqueta separada', 'Etiquetas'],
  ['tab-top', 'Pestaña superior', 'Etiquetas'],
  ['banner-compact', 'Banner compacto', 'Dispositivos', 2],
  ['brackets-side', 'Visor con llamada lateral', 'Laterales', 2],
  ['phone-outline', 'Marco de teléfono', 'Dispositivos'],
  ['scan-label-outline', 'Tarjeta con firma inferior', 'Tarjetas'],
  ['inverse-caption', 'Cabecera de contraste', 'Tarjetas'],
  ['pill-side', 'Etiqueta lateral alargada', 'Laterales'],
  ['shield-label', 'Escudo con visor', 'Sellos'],
  ['label-pill', 'Pastilla inferior', 'Etiquetas'],
  ['shield-outline', 'Escudo de contorno', 'Sellos'],
  ['circle-shadow', 'Círculo con sombra larga', 'Círculos', 2],
  ['circle-dots', 'Círculo punteado', 'Círculos'],
  ['organic', 'Sello orgánico', 'Círculos'],
  ['wave-gradient', 'Banda de ondas', 'Sellos'],
];
export const FRAMES = entries.map(([id, name, group, texts = 1]) => ({
  id,
  name,
  group,
  texts,
  example:
    id === 'scan-bold'
      ? ['ESCANEA\nAQUÍ']
      : id.startsWith('discover-')
        ? ['Escanea para\ndescubrir más', 'MORPHIQ', 'Todo comienza aquí']
        : ['Escanéame', 'Abre tu cámara', 'morphiq.com.mx'],
  labels: id.startsWith('discover-')
    ? ['Llamada principal', 'Nombre o código', 'Descripción inferior']
    : ['Texto principal', 'Texto secundario', 'Texto inferior'],
}));
export function getFrame(id) {
  return FRAMES.find((frame) => frame.id === id) || FRAMES[0];
}
