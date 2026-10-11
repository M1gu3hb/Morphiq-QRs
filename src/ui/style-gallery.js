import { QRStyles } from '../qr/styles.js';
import { encodeLink } from '../qr/encoder.js';
import { $, buttons } from './dom.js';
export function createStyleGallery() {
  $('preset-options').innerHTML = QRStyles.presets
    .map(
      (p) =>
        `<button type="button" class="preset-option" data-preset="${p.id}" aria-pressed="${p.id === 'classic'}"><span class="preset-preview" aria-hidden="true"></span><span class="preset-title">${p.name}</span><span class="preset-family">${p.family}</span></button>`,
    )
    .join('');
  $('preset-count').textContent = QRStyles.presets.length + ' estilos';
  for (const [key, items] of [
    ['module', QRStyles.modules],
    ['eye', QRStyles.eyes],
    ['center', QRStyles.centers],
  ]) {
    $('' + key + '-options').innerHTML = items
      .map(
        (p) =>
          `<button type="button" class="shape-option" data-${key}="${p.id}" aria-pressed="${p.id === 'square'}"><span class="shape-preview" aria-hidden="true"></span><span>${p.name}</span></button>`,
      )
      .join('');
    if (key !== 'center') $(key + '-count').textContent = String(items.length);
  }
  const sampleQr = encodeLink('https://morphiq.com.mx');
  const styleIcons = new Map();
  let catalogReady = false,
    lastStyleKey = '';
  function shapeIcon(key, id) {
    const cache = key + ':' + id;
    if (styleIcons.has(cache)) return styleIcons.get(cache);
    let p = '',
      viewBox = '0 0 7 7';
    if (key === 'module') {
      const pattern = [
          [1, 0, 1, 0, 1],
          [1, 1, 0, 1, 1],
          [0, 1, 1, 1, 0],
          [1, 1, 0, 1, 1],
          [1, 0, 1, 0, 1],
        ],
        q = { getModule: (x, y) => !!pattern[y]?.[x] };
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
          if (q.getModule(x, y)) p += QRStyles.svgPath(QRStyles.modulePath(q, x, y, id));
      viewBox = '-.15 -.15 5.3 5.3';
      p = `<path d="${p}" fill="currentColor"/>`;
    } else if (key === 'eye')
      QRStyles.eyePaths(0, 0, id, 'square').forEach(
        (path, i) =>
          (p += `<path d="${QRStyles.svgPath(path)}" fill="${i === 1 ? '#091322' : 'currentColor'}"/>`),
      );
    else {
      p = `<path d="${QRStyles.svgPath(QRStyles.eyePaths(0, 0, 'square', id)[2])}" fill="currentColor"/>`;
      viewBox = '1.7 1.7 3.6 3.6';
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${p}</svg>`;
    styleIcons.set(cache, svg);
    return svg;
  }
  function prepareCatalog() {
    if (catalogReady) return;
    const rows = new Map(buttons('preset').map((b) => [b.dataset.preset, b]));
    QRStyles.presets.forEach((p) => {
      rows.get(p.id).querySelector('.preset-preview').innerHTML = QRStyles.svg(sampleQr, p, {
        margin: 1,
        size: 162,
      });
    });
    catalogReady = true;
  }
  function updateStyleControls({ module: moduleStyle, eye: eyeStyle, center: centerStyle }) {
    const key = moduleStyle + '|' + eyeStyle + '|' + centerStyle;
    if (key === lastStyleKey) return;
    lastStyleKey = key;
    const preset = QRStyles.presets.find(
      (p) => p.module === moduleStyle && p.eye === eyeStyle && p.center === centerStyle,
    );
    $('preset-name').textContent = preset ? preset.name : 'Personalizado';
    $('preset-icon').innerHTML = QRStyles.svg(
      sampleQr,
      { module: moduleStyle, eye: eyeStyle, center: centerStyle },
      { size: 81 },
    );
    buttons('preset').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.preset === preset?.id)),
    );
    [
      ['module', moduleStyle, QRStyles.modules],
      ['eye', eyeStyle, QRStyles.eyes],
      ['center', centerStyle, QRStyles.centers],
    ].forEach(([key, id, list]) => {
      $(key + '-name').textContent = list.find((s) => s.id === id).name;
      $(key + '-icon').innerHTML = shapeIcon(key, id);
      buttons(key).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === id)));
    });
    const compatible = QRStyles.compatibleCenters(eyeStyle);
    buttons('center').forEach((b) => {
      b.disabled = !compatible.includes(b.dataset.center);
      b.title = b.disabled ? 'Elige otra esquina para usar este centro.' : '';
    });
    $('center-count').textContent = compatible.length + ' / ' + QRStyles.centers.length;
  }
  return { shapeIcon, prepareCatalog, updateStyleControls };
}
