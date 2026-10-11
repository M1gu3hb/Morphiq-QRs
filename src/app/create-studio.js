import { physicalSvg, withDpi } from '../export/print-metadata.js';
import { namespaceSvg } from '../ui/svg.js';
import { createContentController } from '../content/controller.js';
import { readAdvancedOptions, resetAdvanced } from '../advanced/options.js';
import { captureFields, restoreFields, validImage, validSilhouette } from '../projects/state.js';
import { readableDesign } from '../qr/color-effects.js';
import { bindImageEditor } from '../ui/image-editor.js';
import { $, buttons } from '../ui/dom.js';
import { PIXEL_SIZES, DEFAULT_FIELDS } from './defaults.js';
import { encodePayload, outputDimension, imageRoom } from '../qr/encoder.js';
import { artGeometry } from '../image/art.js';
import { QRStyles } from '../qr/styles.js';
import { QRImage } from '../image/framing.js';
import { renderQrSvg } from '../qr/renderer.js';
import { QRCheck } from '../validation/qr-checker.js';
import { normalizeImage, readFile } from '../image/image-loader.js';
import { saveFile } from '../utils/files.js';
import { createSvg } from '../export/svg.js';
import { rasterizeQr } from '../export/raster.js';
import { createPdf } from '../export/pdf.js';
import { createStyleGallery } from '../ui/style-gallery.js';
import { createToast } from '../ui/toast.js';

export function createStudio() {
  const pixelSizes = PIXEL_SIZES;
  let silhouette = null;
  const content = createContentController(() => {
    clearTimeout(inputTimer);
    render();
  });
  const showToast = createToast();
  const { shapeIcon, prepareCatalog, updateStyleControls } = createStyleGallery();
  let qr = null,
    encodedUrl = '',
    moduleStyle = 'square',
    eyeStyle = 'square',
    centerStyle = 'square',
    frameStyle = 'square',
    blendStyle = 'integrated',
    exportFormat = 'png',
    logo = null,
    exporting = false,
    uploading = false,
    inputTimer = 0,
    logoRevision = 0;
  let checking = false,
    checkToken = 0,
    verifiedKey = '',
    lastDesignKey = '';
  function eccName() {
    return document.querySelector('input[name="ecc"]:checked').value;
  }
  function setEcc(value) {
    document.querySelectorAll('input[name="ecc"]').forEach((e) => (e.checked = e.value === value));
  }
  function hasLogo() {
    return !!logo && $('logo-enabled').checked;
  }
  function validColors() {
    return readableDesign(renderOptions());
  }
  function dimension() {
    const print = readAdvancedOptions().print;
    if (print.enabled) return Math.round((print.width / 25.4) * print.dpi);
    return outputDimension(
      qr,
      Number($('margin').value),
      pixelSizes[Number($('resolution').value)],
    );
  }
  function logoGeometry() {
    if (hasLogo() && qr && $('image-mode').value !== 'center')
      return artGeometry(qr, Number($('margin').value), logo, {
        zoom: Number($('image-zoom').value),
        panX: Number($('image-x').value),
        panY: Number($('image-y').value),
        fit: $('image-fit').value,
      });
    return hasLogo() && qr
      ? QRImage.geometry(qr, Number($('margin').value), logo, {
          sizeModules: Number($('logo-size').value),
          snapPan: true,
          zoom: Number($('image-zoom').value),
          x: Number($('image-x').value),
          y: Number($('image-y').value),
          fit: $('image-fit').value,
          frame: frameStyle,
        })
      : null;
  }
  function imageBackground() {
    return $('logo-base-auto').checked ? $('background').value : $('logo-background').value;
  }
  function renderOptions() {
    return {
      ...readAdvancedOptions(silhouette),
      margin: Number($('margin').value),
      foreground: $('foreground').value,
      background: $('background').value,
      eyes: $('eye-color').value,
      size: dimension(),
      module: moduleStyle,
      eye: eyeStyle,
      center: centerStyle,
      image: hasLogo() ? logo : null,
      frame: frameStyle,
      blend: blendStyle,
      imageModules: Number($('logo-size').value),
      imageSize: (Number($('logo-size').value) / (qr?.size || 29)) * 100,
      zoom: Number($('image-zoom').value),
      panX: Number($('image-x').value),
      panY: Number($('image-y').value),
      fit: $('image-fit').value,
      imageBackground: imageBackground(),
    };
  }
  function svgMarkup() {
    return renderQrSvg(qr, renderOptions());
  }
  function designKey() {
    return JSON.stringify([
      encodedUrl,
      readAdvancedOptions(silhouette),
      moduleStyle,
      eyeStyle,
      centerStyle,
      frameStyle,
      blendStyle,
      exportFormat,
      eccName(),
      hasLogo(),
      logoRevision,
      $('logo-base-auto').checked,
      ...[
        'foreground',
        'eye-color',
        'background',
        'logo-background',
        'margin',
        'logo-size',
        'image-zoom',
        'image-x',
        'image-y',
        'image-fit',
        'resolution',
      ].map((id) => $(id).value),
    ]);
  }
  function invalidateCheck() {
    checkToken++;
    checking = false;
    verifiedKey = '';
    if (!$('check-results').hidden) {
      $('check-summary').textContent = 'El diseño cambió. Vuelve a comprobar el QR.';
      $('check-advice').textContent = '';
      $('check-destination').textContent = '';
      $('check-results').dataset.result = 'changed';
      QRCheck.tests.forEach((_, i) => setCheckStep(i, 'waiting'));
    }
  }
  function setCheckStep(i, state) {
    const row = $('check-step-' + i);
    row.dataset.state = state;
    row.querySelector('.trial-state').textContent = {
      waiting: 'Pendiente',
      running: 'Leyendo…',
      passed: 'Correcto',
      failed: 'No leído',
    }[state];
  }
  async function checkQr() {
    clearTimeout(inputTimer);
    render();
    if (!qr || uploading || checking || exporting) return false;
    const token = ++checkToken,
      key = designKey(),
      expected = encodedUrl,
      svg = svgMarkup();
    checking = true;
    verifiedKey = '';
    $('check-results').hidden = false;
    $('check-results').dataset.result = 'running';
    $('check-summary').textContent = 'Comprobando lectura · 0 / 4';
    $('check-advice').textContent = '';
    $('check-destination').textContent = '';
    QRCheck.tests.forEach((_, i) => setCheckStep(i, 'waiting'));
    updateControls();
    try {
      const result = await QRCheck.run(svg, expected, {
        size: dimension(),
        mime: { jpg: 'image/jpeg', webp: 'image/webp' }[exportFormat] || 'image/png',
        isCurrent: () => token === checkToken && key === designKey(),
        onStep: (i, state) => {
          if (token !== checkToken) return;
          setCheckStep(i, state);
          $('check-summary').textContent =
            'Comprobando lectura · ' + (state === 'running' ? i : i + 1) + ' / 4';
        },
      });
      if (!result || token !== checkToken) return false;
      const count = result.outcomes.filter((t) => t.passed).length,
        passed = result.passed && validColors();
      $('check-results').dataset.result = passed ? 'passed' : 'failed';
      $('check-summary').textContent = passed
        ? 'QR comprobado · 4 de 4 lecturas correctas'
        : count + ' de 4 lecturas correctas · ajusta el diseño';
      if (passed) {
        verifiedKey = key;
        $('check-destination').textContent = 'Contenido leído: ' + expected;
      } else {
        const advice = [];
        if (!validColors()) advice.push('Usa módulos y esquinas más oscuros sobre un fondo claro.');
        if (hasLogo())
          advice.push(
            blendStyle === 'integrated'
              ? 'Reduce el área de imagen o prueba Trama QR.'
              : 'Reduce el zoom o el área de imagen.',
          );
        if (Number($('margin').value) < 4) advice.push('Aumenta el margen a 4 módulos.');
        if (moduleStyle !== 'square' || eyeStyle !== 'square')
          advice.push('Prueba el diseño Clásico para recuperar lectura.');
        $('check-advice').textContent =
          advice.join(' ') || 'Aumenta la resolución o acorta la liga y vuelve a comprobar.';
      }
      return passed;
    } catch (e) {
      if (token === checkToken) {
        $('check-results').dataset.result = 'failed';
        $('check-summary').textContent = 'No se pudo completar la comprobación.';
        $('check-advice').textContent = e.message || 'Vuelve a comprobar el QR.';
      }
      return false;
    } finally {
      if (token === checkToken) {
        checking = false;
        updateControls();
      }
    }
  }
  function updateControls() {
    ['foreground', 'eye-color', 'background', 'logo-background'].forEach((id) => {
      $(id + '-hex').textContent = $(id).value.toUpperCase();
      document
        .querySelector('[data-picker="' + id + '"]')
        ?.style.setProperty('--picked', $(id).value);
    });
    $('margin-value').textContent =
      $('margin').value + (Number($('margin').value) === 1 ? ' módulo' : ' módulos');
    $('resolution-value').textContent = pixelSizes[Number($('resolution').value)] + ' px';
    $('logo-size-value').textContent = $('logo-size').value + ' módulos';
    ['image-zoom', 'image-x', 'image-y'].forEach(
      (id) => ($(id + '-value').textContent = $(id).value + (id === 'image-zoom' ? '%' : '')),
    );
    $('image-base-custom').hidden = $('logo-base-auto').checked;
    $('char-count').textContent = $('url').value.trim().length + ' caracteres';
    document
      .querySelectorAll('input[type="range"]')
      .forEach((e) =>
        e.style.setProperty(
          '--percent',
          ((Number(e.value) - Number(e.min)) / (Number(e.max) - Number(e.min))) * 100 + '%',
        ),
      );
    buttons('color').forEach((b) =>
      b.setAttribute(
        'aria-pressed',
        String(
          b.dataset.color === $('foreground').value && b.dataset.color === $('eye-color').value,
        ),
      ),
    );
    const central = hasLogo();
    if (central) setEcc('H');
    document.querySelector('input[name="ecc"][value="M"]').disabled = central;
    $('ecc-note').textContent = central ? 'Alta activada para la imagen.' : '';
    $('image-settings').classList.toggle('visible', !!logo);
    $('image-name').textContent = logo ? logo.name : '';
    const centralMode = $('image-mode').value === 'center';
    $('logo-size').closest('.control-row').hidden = !centralMode;
    document.querySelector('[data-frame]').closest('.control-row').hidden = !centralMode;
    document.querySelector('[data-blend]').closest('.control-row').hidden = !centralMode;
    const options = readAdvancedOptions(),
      view = qr
        ? svgMarkup()
            .match(/viewBox="([^"]+)"/)[1]
            .split(' ')
            .map(Number)
        : null;
    const widthMm = options.print.enabled ? options.print.width : Number($('pdf-size').value);
    const notes = {
      png: '',
      svg: 'Vectorial',
      pdf: view ? `${widthMm} × ${((widthMm * view[3]) / view[2]).toFixed(1)} mm · vectorial` : '',
      jpg: '',
      webp: '',
    };
    $('export-note').textContent = notes[exportFormat];
    $('download-label').textContent = exporting
      ? 'Preparando…'
      : 'Descargar ' + exportFormat.toUpperCase();
    $('download').disabled = !qr || !validColors() || exporting || uploading || checking;
    $('check-qr').disabled = !qr || exporting || uploading || checking;
    $('check-label').textContent = checking ? 'Comprobando…' : 'Comprobar QR';
    updateStyleControls({ module: moduleStyle, eye: eyeStyle, center: centerStyle });
  }
  function render() {
    try {
      encodedUrl = content.payload();
      if (hasLogo()) setEcc('H');
      qr = encodePayload(encodedUrl, {
        ecc: eccName(),
        hasImage: hasLogo(),
        imageModules: $('image-mode').value === 'center' ? Number($('logo-size').value) : 0,
      });
      $('logo-size').max = String(
        hasLogo() && $('image-mode').value === 'center'
          ? Math.min(14, imageRoom(qr))
          : Math.floor(qr.size * 0.3),
      );
      if (Number($('logo-size').value) > Number($('logo-size').max))
        $('logo-size').value = $('logo-size').max;
      const imageGeometry = logoGeometry();
      if (imageGeometry) {
        for (const [axis, travel] of [
          ['x', imageGeometry.travelX],
          ['y', imageGeometry.travelY],
        ]) {
          const slider = $('image-' + axis),
            limit = Math.max(1, Math.floor(travel));
          const value = QRImage.clamp(Number(slider.value), -limit, limit);
          slider.min = String(-limit);
          slider.max = String(limit);
          slider.value = String(value);
        }
      }
      $('qr-preview').innerHTML = namespaceSvg(svgMarkup(), 'preview');
      $('destination').textContent = encodedUrl;
      const view = svgMarkup()
        .match(/viewBox="([^"]+)"/)[1]
        .split(' ')
        .map(Number);
      $('stat-size').textContent =
        dimension() + ' × ' + Math.round((dimension() * view[3]) / view[2]) + ' px';
      $('stat-grid').textContent = qr.size + ' × ' + qr.size;
      $('stat-ecc').textContent = eccName();
      const valid = validColors();
      $('preview-state').textContent = valid ? 'Listo' : 'Contraste bajo';
      $('preview-status').classList.toggle('error', !valid);
      $('status').textContent = valid ? '' : 'Usa módulos y esquinas oscuros sobre un fondo claro.';
      $('status').classList.toggle('error', !valid);
    } catch (e) {
      qr = null;
      encodedUrl = '';
      $('qr-preview').innerHTML = '<div class="empty">Completa el contenido</div>';
      $('destination').textContent = '—';
      $('stat-size').textContent = '— px';
      $('stat-grid').textContent = '— módulos';
      $('stat-ecc').textContent = eccName();
      $('preview-state').textContent = 'Sin QR';
      $('preview-status').classList.add('error');
      let text = e.message;
      if (e instanceof RangeError || /Data too long/i.test(text))
        text = 'La liga es demasiado larga. Acórtala o usa resistencia simple.';
      else if (e instanceof TypeError) text = 'Revisa que la liga tenga un dominio válido.';
      $('status').textContent = text;
      $('status').classList.add('error');
    }
    const key = designKey();
    if (key !== lastDesignKey) {
      invalidateCheck();
      lastDesignKey = key;
    }
    const g = logoGeometry();
    if (g)
      $('image-editor').innerHTML = renderQrSvg(qr, {
        ...renderOptions(),
        bare: true,
        imageMode: $('image-mode').value,
      })
        .replace(/viewBox="[^"]+"/, `viewBox="${g.start} ${g.start} ${g.side} ${g.side}"`)
        .replaceAll('image-window', 'editor-window')
        .replaceAll('image-safe', 'editor-safe');
    else $('image-editor').innerHTML = '';
    updateControls();
    document.dispatchEvent(new Event('studio:render'));
  }
  async function setLogo(source, name, crop) {
    const token = ++logoRevision;
    uploading = true;
    updateControls();
    try {
      const normalized = await normalizeImage(source, name, crop);
      if (token !== logoRevision) return;
      logo = normalized;
      resetFraming();
      $('logo-enabled').checked = true;
      setEcc('H');
      clearTimeout(inputTimer);
      render();
      if (qr && $('image-mode').value === 'center') {
        $('logo-size').value = String(Math.min(14, imageRoom(qr), Math.round(qr.size * 0.24)));
        render();
      }
    } catch (e) {
      if (token === logoRevision) showToast(e.message);
    } finally {
      if (token === logoRevision) {
        uploading = false;
        updateControls();
      }
    }
  }
  function rasterBlob(mime) {
    return rasterizeQr(svgMarkup(), dimension(), mime).then((blob) =>
      withDpi(blob, renderOptions().print.enabled ? renderOptions().print.dpi : null),
    );
  }
  function makePdf() {
    const options = renderOptions();
    if (
      options.border.enabled ||
      options.silhouette ||
      options.gradient.mode !== 'none' ||
      options.image?.svg ||
      options.imageMode !== 'center' ||
      options.print.enabled
    )
      return import('../export/studio-pdf.js').then((m) =>
        m.createStudioPdf(
          svgMarkup(),
          options.print.enabled ? options.print.width : Number($('pdf-size').value),
        ),
      );
    return createPdf(qr, options, Number($('pdf-size').value));
  }
  async function exportQr() {
    clearTimeout(inputTimer);
    render();
    if (!qr || !validColors() || exporting || uploading || checking) return;
    if (verifiedKey !== designKey() && !(await checkQr())) {
      showToast('Ajusta el diseño hasta superar las cuatro pruebas.');
      return;
    }
    exporting = true;
    updateControls();
    const format = exportFormat;
    // Freeze controls while async image decoding/export is in progress.
    const inputs = Array.from(
      document.querySelectorAll(
        '.controls input,.controls textarea,.controls select,.controls button,#reset,[data-format]',
      ),
    );
    const disabled = inputs.map((e) => e.disabled);
    inputs.forEach((e) => (e.disabled = true));
    try {
      let blob;
      if (format === 'svg')
        blob = createSvg(
          renderOptions().print.enabled
            ? physicalSvg(svgMarkup(), renderOptions().print.width)
            : svgMarkup(),
        );
      else if (format === 'pdf') blob = await makePdf();
      else
        blob = await rasterBlob(
          { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[format],
        );
      saveFile(blob, format, $('filename').value);
      showToast('Descarga preparada · ' + format.toUpperCase());
    } catch (e) {
      showToast(e.message || 'No se pudo exportar. Prueba SVG.');
    } finally {
      inputs.forEach((e, i) => (e.disabled = disabled[i]));
      exporting = false;
      updateControls();
    }
  }
  function choose(key, value) {
    if (key === 'preset') {
      const p = QRStyles.presets.find((p) => p.id === value);
      if (!p) return;
      moduleStyle = p.module;
      eyeStyle = p.eye;
      centerStyle = p.center;
    }
    if (key === 'center' && !QRStyles.compatibleCenters(eyeStyle).includes(value)) return;
    if (key === 'module') moduleStyle = value;
    if (key === 'eye') eyeStyle = value;
    if (key === 'center') centerStyle = value;
    if (key === 'frame') frameStyle = value;
    if (key === 'blend') blendStyle = value;
    if (key === 'format') exportFormat = value;
    if (!QRStyles.compatibleCenters(eyeStyle).includes(centerStyle)) {
      centerStyle = QRStyles.compatibleCenters(eyeStyle)[0];
      showToast('Centro ajustado a la esquina elegida.');
    }
    buttons(key).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === value)));
    clearTimeout(inputTimer);
    render();
  }
  ['preset', 'module', 'eye', 'center', 'frame', 'blend', 'format'].forEach((key) =>
    buttons(key).forEach((b) =>
      b.addEventListener('click', () => {
        choose(key, b.dataset[key]);
        const menu = b.closest('details');
        if (menu) {
          menu.open = false;
          menu.querySelector('summary').focus();
        }
      }),
    ),
  );
  ['module', 'eye', 'center'].forEach((key) =>
    buttons(key).forEach(
      (b) => (b.querySelector('.shape-preview').innerHTML = shapeIcon(key, b.dataset[key])),
    ),
  );
  $('preset-menu').addEventListener('toggle', () => {
    if ($('preset-menu').open) prepareCatalog();
  });
  buttons('color').forEach((b) =>
    b.addEventListener('click', () => {
      $('foreground').value = $('eye-color').value = b.dataset.color;
      $('background').value = '#ffffff';
      clearTimeout(inputTimer);
      render();
    }),
  );
  [
    'foreground',
    'eye-color',
    'background',
    'logo-background',
    'margin',
    'logo-size',
    'image-zoom',
    'image-x',
    'image-y',
    'resolution',
  ].forEach((id) =>
    $(id).addEventListener('input', () => {
      clearTimeout(inputTimer);
      render();
    }),
  );
  $('image-fit').addEventListener('change', () => {
    clearTimeout(inputTimer);
    render();
  });
  $('logo-base-auto').addEventListener('change', render);
  function resetFraming() {
    Object.entries({
      'image-fit': 'auto',
      'image-zoom': '100',
      'image-x': '0',
      'image-y': '0',
    }).forEach(([id, value]) => ($(id).value = value));
  }
  $('image-recenter').addEventListener('click', () => {
    resetFraming();
    render();
  });
  bindImageEditor({
    getGeometry: logoGeometry,
    canEdit: () => hasLogo() && !!qr && !exporting && !uploading,
    onChange: render,
  });
  $('pdf-size').addEventListener('change', updateControls);
  document.querySelectorAll('input[name="ecc"]').forEach((e) =>
    e.addEventListener('change', () => {
      clearTimeout(inputTimer);
      render();
    }),
  );
  $('url').addEventListener('input', () => {
    clearTimeout(inputTimer);
    invalidateCheck();
    qr = null;
    updateControls();
    $('status').textContent = 'Actualizando…';
    inputTimer = setTimeout(render, 150);
  });
  $('paste').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error();
      $('url').value = text;
      clearTimeout(inputTimer);
      render();
      $('url').focus();
    } catch {
      showToast('Pega directamente en el campo con Ctrl + V o mantén presionado.');
      $('url').focus();
    }
  });
  $('upload').addEventListener('click', () => $('logo-file').click());
  $('logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      showToast('Usa una imagen PNG, JPG, WebP o SVG.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('La imagen debe pesar menos de 10 MB.');
      e.target.value = '';
      return;
    }
    try {
      const data = await readFile(file);
      await setLogo(data, file.name);
    } catch (e) {
      showToast(e.message);
    }
    e.target.value = '';
  });
  $('use-brand').addEventListener('click', () =>
    setLogo($('brand-image').src, 'Símbolo Morphiq', { x: 8, y: 114, w: 173, h: 177 }),
  );
  $('logo-enabled').addEventListener('change', () => {
    if ($('logo-enabled').checked && !logo) {
      $('logo-enabled').checked = false;
      $('logo-file').click();
      return;
    }
    clearTimeout(inputTimer);
    render();
  });
  $('remove-logo').addEventListener('click', () => {
    logoRevision++;
    logo = null;
    uploading = false;
    $('logo-enabled').checked = false;
    clearTimeout(inputTimer);
    render();
  });
  $('reset').addEventListener('click', () => {
    clearTimeout(inputTimer);
    resetAdvanced();
    silhouette = null;
    logoRevision++;
    logo = null;
    uploading = false;
    $('logo-enabled').checked = false;
    $('logo-base-auto').checked = true;
    resetFraming();
    Object.entries(DEFAULT_FIELDS).forEach(([id, value]) => ($(id).value = value));
    setEcc('M');
    choose('preset', 'classic');
    choose('frame', 'square');
    choose('blend', 'integrated');
    choose('format', 'png');
    render();
    showToast('Ajustes restablecidos');
  });
  $('download').addEventListener('click', exportQr);
  $('check-qr').addEventListener('click', checkQr);
  render();

  function getState() {
    return {
      version: 2,
      type: content.type,
      fields: captureFields(),
      styles: {
        module: moduleStyle,
        eye: eyeStyle,
        center: centerStyle,
        frame: frameStyle,
        blend: blendStyle,
        format: exportFormat,
      },
      ecc: eccName(),
      logo,
      silhouette,
    };
  }
  function applyState(state) {
    if (exporting || uploading) throw new Error('Espera a que termine la operación actual.');
    if (!state || state.version !== 2)
      throw new Error('El proyecto no es compatible con esta versión.');
    const nextLogo = validImage(state.logo),
      nextSilhouette = validSilhouette(state.silhouette);
    clearTimeout(inputTimer);
    restoreFields(state.fields);
    logo = nextLogo;
    silhouette = nextSilhouette;
    logoRevision++;
    const styles = state.styles || {};
    moduleStyle = QRStyles.modules.some((m) => m.id === styles.module) ? styles.module : 'square';
    eyeStyle = QRStyles.eyes.some((m) => m.id === styles.eye) ? styles.eye : 'square';
    centerStyle = QRStyles.compatibleCenters(eyeStyle).includes(styles.center)
      ? styles.center
      : QRStyles.compatibleCenters(eyeStyle)[0];
    frameStyle = ['square', 'rounded', 'circle'].includes(styles.frame) ? styles.frame : 'square';
    blendStyle = ['integrated', 'weave'].includes(styles.blend) ? styles.blend : 'integrated';
    exportFormat = ['png', 'svg', 'pdf', 'jpg', 'webp'].includes(styles.format)
      ? styles.format
      : 'png';
    setEcc(state.ecc === 'H' ? 'H' : 'M');
    content.select(state.type, false);
    render();
  }
  return {
    render,
    checkQr,
    exportQr,
    getState,
    applyState,
    choose,
    setLogo,
    showToast,
    get qr() {
      return qr;
    },
    get payload() {
      return encodedUrl;
    },
    get busy() {
      return exporting || uploading || checking;
    },
    getOptions: renderOptions,
    getSvg: () => (qr ? svgMarkup() : ''),
    setSilhouette(value) {
      silhouette = value;
      render();
    },
  };
}
