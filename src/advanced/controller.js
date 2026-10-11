import { removeUniformBackground } from '../image/background.js';
import { QRStyles } from '../qr/styles.js';
import { PALETTES } from '../qr/color-effects.js';
import { FRAMES, frameSvg } from '../frames/catalog.js';
import { encodePayload } from '../qr/encoder.js';
import { renderQrSvg } from '../qr/renderer.js';
import { QRCheck } from '../validation/qr-checker.js';
import { readFile } from '../image/image-loader.js';
import { prepareSilhouette } from '../image/silhouette.js';
import { icon, logoImage } from '../ui/icons.js';
import { namespaceSvg } from '../ui/svg.js';
import { saveFile } from '../utils/files.js';
import { initBatch } from './batch.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
export function initAdvanced(studio) {
  const el = (id) => document.getElementById(id);
  let variant = null,
    repairRevision = 0,
    silhouetteRevision = 0;
  let imageBefore = null,
    imageAfterData = null;
  el('remove-image-background').addEventListener('click', async () => {
    const state = studio.getState();
    if (!state.logo || studio.busy) return;
    try {
      const original = structuredClone(state.logo),
        result = await removeUniformBackground(state.logo);
      if (studio.getState().logo?.data !== original.data || studio.busy) return;
      imageBefore = original;
      imageAfterData = result.data;
      state.logo = result;
      studio.applyState(state);
      el('restore-image-background').hidden = false;
    } catch (error) {
      studio.showToast(error.message);
    }
  });
  el('restore-image-background').addEventListener('click', () => {
    if (!imageBefore) return;
    const state = studio.getState();
    state.logo = imageBefore;
    studio.applyState(state);
    el('restore-image-background').hidden = true;
  });
  const sample = encodePayload('https://morphiq.com.mx');
  el('popular-logos').innerHTML = [
    'whatsapp',
    'facebook',
    'instagram',
    'wifi',
    'phone',
    'email',
    'spotify',
    'youtube',
    'map',
  ]
    .map(
      (name) =>
        `<button type="button" data-logo="${name}" title="${name}" aria-label="Usar símbolo ${name}">${icon(name)}</button>`,
    )
    .join('');
  document
    .querySelectorAll('[data-logo]')
    .forEach((b) =>
      b.addEventListener('click', () => studio.setLogo(logoImage(b.dataset.logo), b.dataset.logo)),
    );
  el('palette-options').innerHTML = PALETTES.map(
    (p, i) =>
      `<button type="button" data-palette="${i}" title="${p.name}"><i style="background:linear-gradient(135deg,${p.a},${p.b})"></i><span>${p.name}</span></button>`,
  ).join('');
  el('border-options').innerHTML = FRAMES.map(
    (f) =>
      `<button type="button" class="frame-option" data-border="${f.id}"><span>${namespaceSvg(frameSvg(renderQrSvg(sample, { size: 128 }), { size: 128, background: '#fff', border: { enabled: true, type: f.id, text: 'Escanéame', color: '#123ca3', textColor: '#fff' } }), 'frame-' + f.id)}</span><b>${f.name}</b></button>`,
  ).join('');
  function palette(p) {
    el('foreground').value = p.a;
    el('gradient-color').value = p.b;
    el('background').value = p.bg;
    el('eye-color').value = p.eyes;
    el('border-color').value = p.frame;
    el('border-text-color').value = '#ffffff';
  }
  document.querySelectorAll('[data-palette]').forEach((b) =>
    b.addEventListener('click', () => {
      palette(PALETTES[Number(b.dataset.palette)]);
      studio.render();
    }),
  );
  document.querySelectorAll('[data-border]').forEach((b) =>
    b.addEventListener('click', () => {
      el('border-type').value = b.dataset.border;
      studio.render();
      b.closest('details').open = false;
    }),
  );
  function random(kind) {
    if (studio.busy) return;
    const state = studio.getState(),
      styles = state.styles;
    if (['design', 'all'].includes(kind)) {
      const p = pick(QRStyles.presets.filter((p) => !['heart', 'dots'].includes(p.module)));
      styles.module = p.module;
      styles.eye = p.eye;
      styles.center = p.center;
    }
    if (kind === 'module') styles.module = pick(QRStyles.modules).id;
    if (kind === 'eye') {
      styles.eye = pick(QRStyles.eyes).id;
      styles.center = pick(QRStyles.compatibleCenters(styles.eye));
    }
    if (kind === 'center') styles.center = pick(QRStyles.compatibleCenters(styles.eye));
    if (['palette', 'all'].includes(kind)) {
      const p = pick(PALETTES);
      Object.assign(state.fields, {
        foreground: p.a,
        'gradient-color': p.b,
        background: p.bg,
        'eye-color': p.eyes,
        'border-color': p.frame,
        'border-text-color': '#ffffff',
      });
      if (el('advanced-enabled').checked)
        state.fields['gradient-mode'] = pick(['none', 'linear', 'radial', 'duo']);
    }
    if (['border', 'all'].includes(kind)) {
      state.fields['border-type'] = pick(FRAMES).id;
      if (kind === 'border') state.fields['border-enabled'] = true;
    }
    if (kind === 'border-palette') {
      state.fields['border-color'] = pick(PALETTES).frame;
      state.fields['border-text-color'] = '#ffffff';
    }
    if (kind === 'gradient') {
      state.fields['gradient-mode'] = pick(['linear', 'radial', 'duo']);
      state.fields['gradient-angle'] = String(Math.floor(Math.random() * 24) * 15);
      state.fields['gradient-color'] = pick(PALETTES).b;
    }
    studio.applyState(state);
  }
  el('random-all').addEventListener('click', () => random('all'));
  document.querySelectorAll('[data-random]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      random(b.dataset.random);
    }),
  );
  function sync() {
    if (imageAfterData && studio.getState().logo?.data !== imageAfterData) {
      imageBefore = null;
      imageAfterData = null;
      el('restore-image-background').hidden = true;
    }
    el('advanced-tools').hidden = !el('advanced-enabled').checked;
    el('border-controls').hidden = !el('border-enabled').checked;
    el('print-controls').hidden = !el('print-enabled').checked;
    el('border-name').textContent =
      FRAMES.find((f) => f.id === el('border-type').value)?.name || 'Banda';
    el('gradient-angle-value').textContent = el('gradient-angle').value + '°';
    for (const id of ['gradient-color', 'border-color', 'border-text-color']) {
      el(id + '-hex').textContent = el(id).value.toUpperCase();
      document.querySelector(`[data-picker="${id}"]`).style.setProperty('--picked', el(id).value);
    }
    document
      .querySelectorAll('[data-border]')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.border === el('border-type').value)),
      );
    const options = studio.getOptions(),
      svg = studio.getSvg(),
      view = svg.match(/viewBox="([^\"]+)"/),
      ratio = view ? Number(view[1].split(' ')[3]) / Number(view[1].split(' ')[2]) : 1;
    const w = options.print.width;
    const unitScale =
      options.silhouette && studio.qr
        ? (options.silhouette.box.side * 0.96) / (studio.qr.size + options.margin * 2)
        : 1;
    const module = studio.qr && view ? (w * unitScale) / Number(view[1].split(' ')[2]) : 0;
    el('print-dimensions').textContent =
      `${w} × ${(w * ratio).toFixed(1)} mm · ${options.print.dpi} dpi`;
    el('print-advice').textContent =
      (options.margin < 4 ? 'Usa al menos 4 módulos de margen. ' : '') +
      (module < 0.4
        ? 'Aumenta el tamaño: los módulos quedan por debajo de 0.4 mm.'
        : 'Módulo aproximado: ' + module.toFixed(2) + ' mm.');
    el('silhouette-name').textContent =
      studio.getState().silhouette?.name ||
      'Elige un PNG con transparencia y una zona interior amplia.';
    if (variant) showCompare();
    repairRevision++;
  }
  const extraIds = [
    'advanced-enabled',
    'gradient-mode',
    'gradient-color',
    'gradient-angle',
    'border-enabled',
    'border-text',
    'border-color',
    'border-text-color',
    'silhouette-enabled',
    'campaign-enabled',
    'utm-source',
    'utm-medium',
    'utm-campaign',
    'utm-content',
    'print-enabled',
    'print-width',
    'print-dpi',
    'image-mode',
  ];
  for (const id of extraIds) {
    el(id).addEventListener('input', () => studio.render());
    if (['checkbox', 'select-one'].includes(el(id).type))
      el(id).addEventListener('change', () => {
        if (id === 'print-enabled' && el(id).checked && Number(el('margin').value) < 4) {
          el('margin').value = '4';
          studio.showToast('Impresión: margen ajustado a 4 módulos.');
        }
        studio.render();
      });
  }
  el('silhouette-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const revision = ++silhouetteRevision;
    try {
      if (file.type !== 'image/png' || file.size > 10_000_000)
        throw new Error('Usa PNG transparente de hasta 10 MB.');
      const shape = await prepareSilhouette(await readFile(file), file.name);
      if (revision !== silhouetteRevision) return;
      el('silhouette-enabled').checked = true;
      el('margin').value = String(Math.max(4, Number(el('margin').value)));
      studio.setSilhouette(shape);
    } catch (error) {
      studio.showToast(error.message);
    } finally {
      event.target.value = '';
    }
  });
  el('remove-silhouette').addEventListener('click', () => {
    silhouetteRevision++;
    el('silhouette-enabled').checked = false;
    studio.setSilhouette(null);
  });
  function showCompare() {
    const panel = el('compare-panel');
    panel.hidden = false;
    panel.innerHTML = `<div><span class="eyebrow">VARIANTE A</span><div class="variant-qr">${namespaceSvg(variant.svg, 'compare-a')}</div><button type="button" id="compare-apply" class="tool-button">Usar A</button></div><div><span class="eyebrow">DISEÑO ACTUAL</span><div class="variant-qr">${namespaceSvg(studio.getSvg(), 'compare-b')}</div><button id="compare-close" type="button" class="mini-action">Cerrar comparación</button></div>`;
    el('compare-apply').addEventListener('click', () => studio.applyState(variant.state));
    el('compare-close').addEventListener('click', () => {
      variant = null;
      panel.hidden = true;
    });
  }
  el('compare-save').addEventListener('click', () => {
    if (!studio.qr) return;
    variant = { svg: studio.getSvg(), state: structuredClone(studio.getState()) };
    showCompare();
  });
  el('repair-qr').addEventListener('click', async () => {
    if (!studio.qr || studio.busy) return;
    const token = ++repairRevision,
      payload = studio.payload,
      base = structuredClone(studio.getOptions()),
      state = structuredClone(studio.getState()),
      panel = el('repair-result');
    panel.hidden = false;
    panel.textContent = 'Buscando una variante legible…';
    el('repair-qr').disabled = true;
    try {
      for (let i = 0; i < 3; i++) {
        const options = {
          ...base,
          margin: Math.max(4, base.margin),
          foreground: '#000000',
          eyes: '#000000',
          background: '#ffffff',
          gradient: { mode: 'none' },
          imageBackground: '#ffffff',
          imageModules: Math.min(base.imageModules || 7, i === 0 ? 6 : 4),
          blend: 'weave',
        };
        if (i >= 1) {
          options.module = 'extra-rounded';
          options.eye = 'rounded';
          options.center = 'rounded';
        }
        if (i === 2) {
          options.silhouette = null;
          options.imageMode = 'center';
          options.border = { ...base.border, enabled: false };
        }
        const qr = encodePayload(payload, {
            ecc: 'H',
            hasImage: !!options.image,
            imageModules: options.imageMode === 'center' ? options.imageModules : 0,
          }),
          svg = renderQrSvg(qr, options),
          result = await QRCheck.run(svg, payload, {
            isCurrent: () => token === repairRevision,
            onStep: (index, phase) => {
              if (token === repairRevision)
                panel.textContent = `Variante ${i + 1} · prueba ${index + 1} / 4 · ${phase === 'running' ? 'leyendo' : 'revisada'}`;
            },
          });
        if (token !== repairRevision) return;
        if (!result?.passed) continue;
        const candidate = structuredClone(state);
        Object.assign(candidate.fields, {
          margin: String(options.margin),
          foreground: '#000000',
          'eye-color': '#000000',
          background: '#ffffff',
          'gradient-mode': 'none',
          'logo-size': String(options.imageModules),
          'logo-base-auto': true,
        });
        candidate.ecc = 'H';
        candidate.styles.blend = 'weave';
        candidate.styles.module = options.module;
        candidate.styles.eye = options.eye;
        candidate.styles.center = options.center;
        if (i === 2) {
          candidate.fields['silhouette-enabled'] = false;
          candidate.fields['border-enabled'] = false;
          candidate.fields['image-mode'] = 'center';
        }
        panel.innerHTML = `<span class="eyebrow">4 DE 4 LECTURAS</span><div class="variant-qr">${namespaceSvg(svg, 'repair')}</div><p class="small-note">Margen amplio, tinta negra, resistencia alta${options.image ? ' y menor área de imagen' : ''}${i >= 1 ? ', formas conectadas' : ''}${i === 2 ? ' y silueta/marco desactivados' : ''}.</p><button id="repair-apply" type="button" class="tool-button">Aplicar esta sugerencia</button>`;
        el('repair-apply').addEventListener('click', () => {
          studio.applyState(candidate);
          panel.hidden = true;
        });
        return;
      }
      panel.textContent =
        'No se encontró una variante que supere las cuatro lecturas. Reduce la imagen, usa un contenido más corto o aumenta el margen.';
    } catch (error) {
      panel.textContent = error.message;
    } finally {
      el('repair-qr').disabled = false;
    }
  });
  el('print-sheet').addEventListener('click', async () => {
    if (!studio.qr || studio.busy) return;
    el('print-sheet').disabled = true;
    try {
      const { createPrintSheet } = await import('../export/studio-pdf.js');
      const blob = await createPrintSheet(
        studio.getSvg(),
        studio.getOptions().print.width,
        studio.payload,
      );
      saveFile(blob, 'pdf', 'morphiq-etiquetas-a4');
    } catch (error) {
      studio.showToast(error.message);
    } finally {
      el('print-sheet').disabled = false;
    }
  });
  document.addEventListener('studio:render', sync);
  initBatch(studio);
  sync();
}
