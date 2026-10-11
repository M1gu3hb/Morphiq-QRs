/* Morphiq QR visual geometry. Original implementation; style families researched in
 * github.com/kozakdenys/qr-code-styling, github.com/qr-platform/qr-code.js,
 * github.com/NeaByteLab/QR-Generator and github.com/deaa-jahjah/artistic_qr.
 * One geometry source is used for SVG, raster previews and vector PDF exports.
 */
'use strict';
export const QRStyles = (() => {
  const modules = [
    ['square', 'Rectos', 'Clásicos'],
    ['rounded', 'Suaves', 'Orgánicos'],
    ['dots', 'Puntos', 'Puntos'],
    ['extra-rounded', 'Conectados', 'Orgánicos'],
    ['classy', 'Diagonal', 'Orgánicos'],
    ['classy-rounded', 'Diagonal suave', 'Orgánicos'],
    ['small-square', 'Baldosas', 'Geométricos'],
    ['tiny-square', 'Microcuadros', 'Geométricos'],
    ['tiles', 'Azulejos', 'Geométricos'],
    ['diamond', 'Rombos', 'Geométricos'],
    ['hexagon', 'Hexágonos', 'Geométricos'],
    ['octagon', 'Octágonos', 'Geométricos'],
    ['star', 'Estrellas', 'Símbolos'],
    ['plus', 'Cruces', 'Símbolos'],
    ['cross', 'Equis', 'Símbolos'],
    ['horizontal', 'Líneas horizontales', 'Líneas'],
    ['vertical', 'Líneas verticales', 'Líneas'],
    ['capsule', 'Cápsulas', 'Líneas'],
    ['woven', 'Tejido', 'Líneas'],
    ['leaf', 'Hojas', 'Orgánicos'],
    ['random-dots', 'Puntos variables', 'Puntos'],
    ['mosaic', 'Mosaico', 'Geométricos'],
    ['heart', 'Corazones', 'Símbolos'],
    ['triangle', 'Triángulos', 'Geométricos'],
    ['triangle-down', 'Triángulos invertidos', 'Geométricos'],
    ['shuriken', 'Shuriken', 'Símbolos'],
    ['chevron', 'Chevron', 'Geométricos'],
    ['bowtie', 'Lazos', 'Símbolos'],
    ['droplet', 'Gotas', 'Orgánicos'],
    ['flower', 'Flores', 'Orgánicos'],
    ['circuit', 'Circuito', 'Líneas'],
    ['rails', 'Rieles', 'Líneas'],
    ['ripple', 'Ondas', 'Orgánicos'],
    ['staggered', 'Ladrillos', 'Geométricos'],
    ['microdots', 'Microórbitas', 'Puntos'],
    ['braided', 'Trenzado', 'Líneas'],
    ['glitch', 'Glitch', 'Experimentales'],
    ['burst', 'Destellos', 'Símbolos'],
    ['crosshair', 'Miras', 'Símbolos'],
    ['fluid', 'Fluido', 'Orgánicos'],
    ['contour', 'Contornos', 'Experimentales'],
  ].map(([id, name, family]) => ({ id, name, family }));
  const eyes = [
    ['square', 'Rectas'],
    ['rounded', 'Suaves'],
    ['extra-rounded', 'Redondeadas'],
    ['circle', 'Circulares'],
    ['classy', 'Diagonal'],
    ['leaf', 'Hojas'],
    ['outpoint', 'Punta exterior'],
    ['inpoint', 'Punta interior'],
    ['octagon', 'Octagonales'],
  ].map(([id, name]) => ({ id, name }));
  const centers = [
    ['square', 'Cuadrados'],
    ['rounded', 'Suaves'],
    ['circle', 'Círculos'],
    ['classy', 'Diagonal'],
    ['leaf', 'Hojas'],
    ['octagon', 'Octágonos'],
    ['extra-rounded', 'Redondeados'],
  ].map(([id, name]) => ({ id, name }));
  const presets = [
    ['classic', 'Clásico', 'square', 'square', 'square'],
    ['soft', 'Suave', 'rounded', 'rounded', 'rounded'],
    ['dot', 'Puntos', 'dots', 'circle', 'circle'],
    ['connected', 'Conectado', 'extra-rounded', 'extra-rounded', 'rounded'],
    ['diagonal', 'Diagonal', 'classy', 'classy', 'extra-rounded'],
    ['diagonal-soft', 'Diagonal suave', 'classy-rounded', 'classy', 'rounded'],
    ['tiles', 'Baldosas', 'small-square', 'square', 'square'],
    ['micro', 'Microcuadros', 'tiny-square', 'square', 'square'],
    ['ceramic', 'Azulejos', 'tiles', 'rounded', 'rounded'],
    ['diamond', 'Rombos', 'diamond', 'square', 'square'],
    ['hexagon', 'Hexágonos', 'hexagon', 'octagon', 'octagon'],
    ['octagon', 'Octágonos', 'octagon', 'octagon', 'square'],
    ['stellar', 'Estelar', 'star', 'square', 'square'],
    ['crosses', 'Cruces', 'plus', 'square', 'square'],
    ['x', 'Equis', 'cross', 'square', 'square'],
    ['horizontal', 'Horizontal', 'horizontal', 'rounded', 'rounded'],
    ['vertical', 'Vertical', 'vertical', 'rounded', 'rounded'],
    ['capsules', 'Cápsulas', 'capsule', 'rounded', 'rounded'],
    ['woven', 'Tejido', 'woven', 'classy', 'rounded'],
    ['leaves', 'Hojas', 'leaf', 'leaf', 'leaf'],
    ['constellation', 'Constelación', 'random-dots', 'circle', 'circle'],
    ['mosaic', 'Mosaico', 'mosaic', 'square', 'square'],
    ['orbit', 'Órbita', 'diamond', 'circle', 'circle'],
    ['pixel', 'Píxel', 'square', 'circle', 'circle'],
    ['bubble', 'Burbuja', 'rounded', 'circle', 'circle'],
    ['outpoint', 'Punta exterior', 'classy-rounded', 'outpoint', 'leaf'],
    ['inpoint', 'Punta interior', 'extra-rounded', 'inpoint', 'rounded'],
    ['prism', 'Prisma', 'diamond', 'octagon', 'rounded'],
    ['honeycomb', 'Colmena', 'hexagon', 'extra-rounded', 'rounded'],
    ['ribbon', 'Cinta', 'horizontal', 'leaf', 'leaf'],
    ['totem', 'Tótem', 'vertical', 'outpoint', 'square'],
    ['heart', 'Corazón', 'heart', 'rounded', 'rounded'],
    ['triangle', 'Triangular', 'triangle', 'square', 'square'],
    ['triangle-down', 'Triangular inverso', 'triangle-down', 'square', 'square'],
    ['shuriken', 'Shuriken', 'shuriken', 'rounded', 'rounded'],
    ['chevron', 'Chevron', 'chevron', 'square', 'square'],
    ['bowtie', 'Lazos', 'bowtie', 'rounded', 'rounded'],
    ['droplet', 'Gotas', 'droplet', 'leaf', 'leaf'],
    ['flower', 'Botánico', 'flower', 'rounded', 'rounded'],
    ['circuit', 'Circuito', 'circuit', 'square', 'square'],
    ['rails', 'Rieles', 'rails', 'square', 'square'],
    ['ripple', 'Ondas', 'ripple', 'rounded', 'rounded'],
    ['staggered', 'Ladrillos', 'staggered', 'square', 'square'],
    ['microdots', 'Microórbitas', 'microdots', 'circle', 'circle'],
    ['braided', 'Trenza', 'braided', 'rounded', 'rounded'],
    ['glitch', 'Glitch', 'glitch', 'square', 'square'],
    ['burst', 'Destellos', 'burst', 'rounded', 'rounded'],
    ['crosshair', 'Miras', 'crosshair', 'square', 'square'],
    ['fluid', 'Fluido', 'fluid', 'extra-rounded', 'rounded'],
    ['contour', 'Contorno', 'contour', 'rounded', 'rounded'],
    ['minimal', 'Esencial', 'tiny-square', 'rounded', 'rounded'],
    ['airy', 'Ligero', 'small-square', 'circle', 'circle'],
    ['mono', 'Monolito', 'square', 'outpoint', 'square'],
    ['petal', 'Pétalos', 'flower', 'circle', 'circle'],
    ['tech', 'Tecnológico', 'circuit', 'octagon', 'square'],
    ['static', 'Estática', 'glitch', 'octagon', 'rounded'],
    ['splash', 'Salpicadura', 'burst', 'circle', 'circle'],
    ['droplet-orbit', 'Gotas orbitales', 'droplet', 'circle', 'circle'],
    ['mesh', 'Malla', 'braided', 'classy', 'rounded'],
    ['industrial', 'Industrial', 'rails', 'inpoint', 'square'],
    ['terrain', 'Relieve', 'contour', 'square', 'leaf'],
    ['wild', 'Silvestre', 'shuriken', 'leaf', 'leaf'],
    ['signal', 'Señal', 'chevron', 'outpoint', 'square'],
    ['ripple-orbit', 'Ondas orbitales', 'ripple', 'circle', 'circle'],
  ].map(([id, name, module, eye, center]) => ({
    id,
    name,
    module,
    eye,
    center,
    family: modules.find((m) => m.id === module).family,
  }));
  // Finder rings and centers need compatible geometry to retain scan ratios.
  const compatible = {
    square: ['square', 'rounded', 'leaf'],
    rounded: ['square', 'rounded', 'leaf'],
    'extra-rounded': ['rounded', 'octagon', 'extra-rounded'],
    circle: ['circle', 'classy', 'extra-rounded'],
    classy: ['rounded', 'octagon', 'extra-rounded'],
    leaf: ['square', 'rounded', 'leaf'],
    outpoint: ['square', 'rounded', 'leaf'],
    inpoint: ['square', 'rounded', 'leaf'],
    octagon: ['square', 'rounded', 'leaf', 'octagon', 'extra-rounded'],
  };
  const compatibleCenters = (eye) => compatible[eye];
  const K = 0.552284749831,
    number = (v) => Number(v.toFixed(4)).toString();
  function rect(x, y, w, h, r = 0) {
    const a = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.min(v, w / 2, h / 2)),
      [tl, tr, br, bl] = a;
    if (a.every((v) => v === 0))
      return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    return [
      ['M', x + tl, y],
      ['L', x + w - tr, y],
      ['C', x + w - tr + tr * K, y, x + w, y + tr - tr * K, x + w, y + tr],
      ['L', x + w, y + h - br],
      ['C', x + w, y + h - br + br * K, x + w - br + br * K, y + h, x + w - br, y + h],
      ['L', x + bl, y + h],
      ['C', x + bl - bl * K, y + h, x, y + h - bl + bl * K, x, y + h - bl],
      ['L', x, y + tl],
      ['C', x, y + tl - tl * K, x + tl - tl * K, y, x + tl, y],
      ['Z'],
    ];
  }
  function polygon(x, y, w, h, points) {
    return points.map(([a, b], i) => [i ? 'L' : 'M', x + a * w, y + b * h]).concat([['Z']]);
  }
  function star(x, y, w, h) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 0.34 : 0.52;
      p.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
    }
    return polygon(x, y, w, h, p);
  }
  const diamond = [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ],
    hexagon = [
      [0.22, 0],
      [0.78, 0],
      [1, 0.5],
      [0.78, 1],
      [0.22, 1],
      [0, 0.5],
    ],
    octagon = [
      [0.18, 0],
      [0.82, 0],
      [1, 0.18],
      [1, 0.82],
      [0.82, 1],
      [0.18, 1],
      [0, 0.82],
      [0, 0.18],
    ];
  const plus = [
    [0.2, 0],
    [0.8, 0],
    [0.8, 0.2],
    [1, 0.2],
    [1, 0.8],
    [0.8, 0.8],
    [0.8, 1],
    [0.2, 1],
    [0.2, 0.8],
    [0, 0.8],
    [0, 0.2],
    [0.2, 0.2],
  ];
  const cross = [
    [0, 0.18],
    [0.18, 0],
    [0.5, 0.28],
    [0.82, 0],
    [1, 0.18],
    [0.72, 0.5],
    [1, 0.82],
    [0.82, 1],
    [0.5, 0.72],
    [0.18, 1],
    [0, 0.82],
    [0.28, 0.5],
  ];
  function modulePath(q, x, y, type) {
    const dark = (dx, dy) => q.getModule(x + dx, y + dy),
      top = dark(0, -1),
      right = dark(1, 0),
      bottom = dark(0, 1),
      left = dark(-1, 0);
    switch (type) {
      case 'rounded':
        return rect(x, y, 1, 1, 0.22);
      case 'dots':
        return rect(x + 0.03, y + 0.03, 0.94, 0.94, 0.47);
      case 'extra-rounded':
        return rect(x, y, 1, 1, [
          !top && !left ? 0.48 : 0,
          !top && !right ? 0.48 : 0,
          !bottom && !right ? 0.48 : 0,
          !bottom && !left ? 0.48 : 0,
        ]);
      case 'classy':
        return rect(x, y, 1, 1, [!top && !left ? 0.5 : 0, 0, !bottom && !right ? 0.5 : 0, 0]);
      case 'classy-rounded':
        return rect(x, y, 1, 1, [
          !top && !left ? 0.5 : 0,
          !top && !right ? 0.22 : 0,
          !bottom && !right ? 0.5 : 0,
          !bottom && !left ? 0.22 : 0,
        ]);
      case 'small-square':
        return rect(x + 0.08, y + 0.08, 0.84, 0.84);
      case 'tiny-square':
        return rect(x + 0.14, y + 0.14, 0.72, 0.72);
      case 'tiles':
        return rect(x + 0.05, y + 0.05, 0.9, 0.9, 0.12);
      case 'diamond':
        return polygon(x, y, 1, 1, diamond);
      case 'hexagon':
        return polygon(x, y, 1, 1, hexagon);
      case 'octagon':
        return polygon(x, y, 1, 1, octagon);
      case 'star':
        return star(x, y, 1, 1);
      case 'plus':
        return polygon(x, y, 1, 1, plus);
      case 'cross':
        return polygon(x, y, 1, 1, cross);
      case 'horizontal':
        return rect(x, y + 0.08, 1, 0.84, [
          left ? 0 : 0.42,
          right ? 0 : 0.42,
          right ? 0 : 0.42,
          left ? 0 : 0.42,
        ]);
      case 'vertical':
        return rect(x + 0.08, y, 0.84, 1, [
          top ? 0 : 0.42,
          top ? 0 : 0.42,
          bottom ? 0 : 0.42,
          bottom ? 0 : 0.42,
        ]);
      case 'capsule':
        return rect(x, y + 0.08, 1, 0.84, 0.42);
      case 'woven':
        return (x + y) % 2 ? rect(x + 0.08, y, 0.84, 1, 0.26) : rect(x, y + 0.08, 1, 0.84, 0.26);
      case 'leaf':
        return rect(x, y, 1, 1, [0.5, 0.04, 0.5, 0.04]);
      case 'random-dots': {
        const r = 0.39 + ((x * 73 + y * 37) % 11) / 100;
        return rect(x + 0.5 - r, y + 0.5 - r, r * 2, r * 2, r);
      }
      case 'mosaic': {
        const size = 0.78 + ((x * 13 + y * 7) % 12) / 50;
        return rect(x + (1 - size) / 2, y + (1 - size) / 2, size, size, 0.07);
      }
      case 'heart':
        return heartPath(x, y, 1);
      case 'triangle':
        return polygon(x, y, 1, 1, [
          [0.5, 0],
          [1, 1],
          [0, 1],
        ]);
      case 'triangle-down':
        return polygon(x, y, 1, 1, [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ]);
      case 'shuriken':
        return polygon(x, y, 1, 1, [
          [0.08, 0],
          [0.58, 0.2],
          [1, 0.08],
          [0.8, 0.58],
          [0.92, 1],
          [0.42, 0.8],
          [0, 0.92],
          [0.2, 0.42],
        ]);
      case 'chevron':
        return polygon(x, y, 1, 1, [
          [0, 0],
          [0.67, 0],
          [1, 0.5],
          [0.67, 1],
          [0, 1],
          [0.27, 0.5],
        ]);
      case 'bowtie':
        return polygon(x, y, 1, 1, [
          [0, 0.04],
          [0.5, 0.25],
          [1, 0.04],
          [1, 0.96],
          [0.5, 0.75],
          [0, 0.96],
        ]);
      case 'droplet':
        return rect(x, y, 1, 1, [0.48, 0.48, 0.05, 0.48]);
      case 'flower':
        return [
          ...rect(x + 0.16, y + 0.16, 0.68, 0.68, 0.3),
          ...rect(x + 0.3, y, 0.4, 1, 0.2),
          ...rect(x, y + 0.3, 1, 0.4, 0.2),
        ];
      case 'circuit':
        return [
          ...rect(x + 0.12, y + 0.12, 0.76, 0.76, 0.2),
          ...(top ? rect(x + 0.38, y, 0.24, 0.5) : []),
          ...(bottom ? rect(x + 0.38, y + 0.5, 0.24, 0.5) : []),
          ...(left ? rect(x, y + 0.38, 0.5, 0.24) : []),
          ...(right ? rect(x + 0.5, y + 0.38, 0.5, 0.24) : []),
        ];
      case 'rails':
        return [
          ...rect(x + 0.12, y + 0.12, 0.76, 0.76),
          ...rect(x, y + 0.24, 1, 0.14),
          ...rect(x, y + 0.62, 1, 0.14),
        ];
      case 'ripple':
        return rect(
          x + 0.03,
          y + 0.03,
          0.94,
          0.94,
          (x + y) % 2 ? [0.42, 0.12, 0.42, 0.12] : [0.12, 0.42, 0.12, 0.42],
        );
      case 'staggered':
        return rect(
          x + 0.02,
          y + 0.09,
          0.96,
          0.82,
          (x + y) % 2 ? [0, 0.28, 0, 0.28] : [0.28, 0, 0.28, 0],
        );
      case 'microdots':
        return [
          ...rect(x + 0.15, y + 0.15, 0.7, 0.7, 0.35),
          ...rect(x + 0.04, y + 0.04, 0.12, 0.12, 0.06),
          ...rect(x + 0.84, y + 0.84, 0.12, 0.12, 0.06),
        ];
      case 'braided':
        return (x + y) % 2
          ? rect(x + 0.07, y, 0.86, 1, [0.4, 0, 0.4, 0])
          : rect(x, y + 0.07, 1, 0.86, [0, 0.4, 0, 0.4]);
      case 'glitch': {
        const shift = (((x * 19 + y * 31) % 5) - 2) * 0.025;
        return [
          ...rect(x + 0.12 + shift, y + 0.14, 0.76, 0.72),
          ...rect(x + 0.02, y + 0.06, 0.72, 0.12),
          ...rect(x + 0.26, y + 0.82, 0.72, 0.12),
        ];
      }
      case 'burst': {
        const points = [];
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8,
            r = i % 2 ? 0.4 : 0.52;
          points.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
        }
        return polygon(x, y, 1, 1, points);
      }
      case 'crosshair':
        return [
          ...rect(x + 0.15, y + 0.15, 0.7, 0.7, 0.1),
          ...rect(x + 0.43, y, 0.14, 1),
          ...rect(x, y + 0.43, 1, 0.14),
        ];
      case 'fluid':
        return rect(x, y, 1, 1, [
          !top && !left ? 0.5 : 0.12,
          !top && !right ? 0.5 : 0.12,
          !bottom && !right ? 0.5 : 0.12,
          !bottom && !left ? 0.5 : 0.12,
        ]);
      case 'contour':
        return rect(x, y + 0.045, 1, 0.91, [0.28, 0.04, 0.28, 0.04]);
      default:
        return rect(x, y, 1, 1);
    }
  }
  function heartPath(x, y, w) {
    return [
      ['M', x + w / 2, y + w],
      ['C', x + w * 0.42, y + w * 0.92, x, y + w * 0.57, x, y + w * 0.28],
      ['C', x, y - w * 0.03, x + w * 0.34, y - w * 0.08, x + w / 2, y + w * 0.2],
      ['C', x + w * 0.66, y - w * 0.08, x + w, y - w * 0.03, x + w, y + w * 0.28],
      ['C', x + w, y + w * 0.57, x + w * 0.58, y + w * 0.92, x + w / 2, y + w],
      ['Z'],
    ];
  }
  function innerPath(x, y, w, type) {
    if (type === 'diamond') return polygon(x, y, w, w, diamond);
    if (type === 'hexagon') return polygon(x, y, w, w, hexagon);
    if (type === 'plus') return polygon(x, y, w, w, plus);
    if (type === 'star') return star(x, y, w, w);
    if (type === 'octagon') return polygon(x, y, w, w, octagon);
    const r =
      type === 'circle'
        ? w / 2
        : type === 'rounded'
          ? w * 0.18
          : type === 'extra-rounded'
            ? w * 0.34
            : type === 'classy'
              ? [w * 0.45, 0, w * 0.45, 0]
              : type === 'leaf'
                ? [0, w * 0.45, 0, w * 0.45]
                : 0;
    return rect(x, y, w, w, r);
  }
  function eyePaths(x, y, type, center) {
    let outer, inner;
    if (type === 'octagon') {
      outer = polygon(x, y, 7, 7, [
        [0.13, 0],
        [0.87, 0],
        [1, 0.13],
        [1, 0.87],
        [0.87, 1],
        [0.13, 1],
        [0, 0.87],
        [0, 0.13],
      ]);
      inner = polygon(x + 1, y + 1, 5, 5, [
        [0.11, 0],
        [0.89, 0],
        [1, 0.11],
        [1, 0.89],
        [0.89, 1],
        [0.11, 1],
        [0, 0.89],
        [0, 0.11],
      ]);
    } else {
      const r =
        type === 'rounded'
          ? 0.85
          : type === 'extra-rounded'
            ? 1.9
            : type === 'circle'
              ? 3.5
              : type === 'classy'
                ? [2.1, 0, 2.1, 0]
                : type === 'leaf'
                  ? [0, 2.4, 0, 2.4]
                  : type === 'outpoint'
                    ? [0, 1.7, 1.7, 1.7]
                    : type === 'inpoint'
                      ? [1.7, 1.7, 0, 1.7]
                      : 0;
      const ri = Array.isArray(r) ? r.map((v) => Math.max(0, v - 0.8)) : Math.max(0, r - 0.8);
      outer = rect(x, y, 7, 7, r);
      inner = rect(x + 1, y + 1, 5, 5, ri);
    }
    return [outer, inner, innerPath(x + 2, y + 2, 3, center)];
  }
  function inFinder(q, x, y) {
    const n = q.size;
    return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  }
  function protectedModule(q, x, y, positions) {
    const n = q.size;
    if (x === 6 || y === 6 || x === 8 || y === 8) return true;
    if ((x < 9 && y < 9) || (x >= n - 8 && y < 9) || (x < 9 && y >= n - 8)) return true;
    if (q.version >= 7 && ((x >= n - 11 && y < 6) || (y >= n - 11 && x < 6))) return true;
    for (let i = 0; i < positions.length; i++)
      for (let j = 0; j < positions.length; j++) {
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === positions.length - 1) ||
          (i === positions.length - 1 && j === 0)
        )
          continue;
        if (Math.abs(x - positions[i]) <= 2 && Math.abs(y - positions[j]) <= 2) return true;
      }
    return false;
  }
  function dataPath(q, type, margin) {
    const p = [],
      a = q.getAlignmentPatternPositions();
    for (let y = 0; y < q.size; y++)
      for (let x = 0; x < q.size; x++)
        if (q.getModule(x, y) && !inFinder(q, x, y)) {
          const shape = modulePath(q, x, y, protectedModule(q, x, y, a) ? 'square' : type);
          p.push(...translate(shape, margin, margin));
        }
    return p;
  }
  function translate(path, x, y) {
    return path.map((c) => c.map((v, i) => (i === 0 ? v : v + (i % 2 ? x : y))));
  }
  function svgPath(path) {
    return path.map((c) => c[0] + c.slice(1).map(number).join(' ')).join('');
  }
  function pdfPath(path, unit, page) {
    return (
      path
        .map((c) => {
          if (c[0] === 'Z') return 'h';
          const nums = c
            .slice(1)
            .map((v, i) => number(i % 2 ? page - v * unit : v * unit))
            .join(' ');
          return nums + ' ' + { M: 'm', L: 'l', C: 'c' }[c[0]];
        })
        .join('\n') + '\nf\n'
    );
  }
  function svg(
    q,
    style,
    { margin = 1, fg = '#000000', bg = '#ffffff', eyes: eyeColor = fg, size = 256 } = {},
  ) {
    const n = q.size + margin * 2;
    let paths = `<path d="${svgPath(dataPath(q, style.module, margin))}" fill="${fg}"/>`;
    for (const [x, y] of [
      [margin, margin],
      [margin + q.size - 7, margin],
      [margin, margin + q.size - 7],
    ])
      eyePaths(x, y, style.eye, style.center).forEach(
        (p, i) => (paths += `<path d="${svgPath(p)}" fill="${i === 1 ? bg : eyeColor}"/>`),
      );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}"><rect width="${n}" height="${n}" fill="${bg}"/>${paths}</svg>`;
  }
  return {
    modules,
    eyes,
    centers,
    presets,
    compatibleCenters,
    modulePath,
    eyePaths,
    rect,
    svgPath,
    pdfPath,
    dataPath,
    svg,
    protectedModule,
  };
})();
