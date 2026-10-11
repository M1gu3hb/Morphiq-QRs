import { contentPayload } from '../content/payloads.js';
import { encodePayload } from '../qr/encoder.js';
import { renderQrSvg } from '../qr/renderer.js';
import { QRCheck } from '../validation/qr-checker.js';
import { readableDesign } from '../qr/color-effects.js';
import { safeFilename, saveFile } from '../utils/files.js';
import { rasterizeQr } from '../export/raster.js';
import { physicalSvg, withDpi } from '../export/print-metadata.js';

export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('El CSV tiene una comilla sin cerrar.');
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function batchRows(text) {
  if (text.length > 200000) throw new Error('El lote es demasiado grande.');
  const first = text.trim().split(/\r?\n/)[0] || '';
  let rows;
  if (!/^(nombre|name|tipo|type|url|phone|ssid),/i.test(first))
    rows = text
      .split(/\r?\n/)
      .filter((v) => v.trim())
      .map((url, i) => ({ name: 'qr-' + (i + 1), type: 'url', fields: { url: url.trim() } }));
  else {
    const all = parseCsv(text),
      headers = all.shift().map((h) =>
        h
          .trim()
          .replace(/^\uFEFF/, '')
          .toLowerCase(),
      );
    rows = all.map((row, i) => {
      const f = Object.fromEntries(headers.map((h, j) => [h, row[j] || '']));
      return {
        name: f.nombre || f.name || 'qr-' + (i + 1),
        type: f.tipo || f.type || 'url',
        fields: { ...f, hidden: f.hidden === 'true' },
      };
    });
  }
  if (!rows.length) throw new Error('Agrega contenido al lote.');
  if (rows.length > 100) throw new Error('Usa hasta 100 QRs por lote.');
  return rows;
}
export function initBatch(studio) {
  const el = (id) => document.getElementById(id);
  let cancelled = false,
    running = false;
  function preview() {
    try {
      const rows = batchRows(el('batch-input').value);
      el('batch-preview').textContent =
        rows
          .slice(0, 6)
          .map((r, i) => `${i + 1}. ${r.name} · ${r.type}`)
          .join('\n') + (rows.length > 6 ? `\n+ ${rows.length - 6} más` : '');
    } catch (error) {
      el('batch-preview').textContent = error.message;
    }
  }
  el('batch-input').addEventListener('input', preview);
  el('batch-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 200000) throw new Error('Usa un CSV de hasta 200 KB.');
      el('batch-input').value = await file.text();
      preview();
    } catch (error) {
      el('batch-status').textContent = error.message;
    }
    event.target.value = '';
  });
  el('batch-template').addEventListener('click', () =>
    saveFile(
      new Blob(
        [
          'nombre,tipo,url,phone,message,ssid,password,security,name,email,company\nMorphiq,url,https://morphiq.com.mx,,,,,,,,\nWhatsApp,whatsapp,,525512345678,Hola,,,,,,\nMi red,wifi,,,,Morphiq,TuContraseña,WPA,,,\nContacto,contact,,,,,,,Miguel,miguel@example.com,Morphiq\n',
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'csv',
      'morphiq-lote-ejemplo',
    ),
  );
  el('batch-cancel').addEventListener('click', () => {
    cancelled = true;
    el('batch-status').textContent = 'Cancelando…';
  });
  el('batch-generate').addEventListener('click', async () => {
    if (running || studio.busy) return;
    let controls = [],
      disabled = [];
    try {
      const rows = batchRows(el('batch-input').value),
        options = structuredClone(studio.getOptions()),
        format = el('batch-format').value;
      if (!readableDesign(options))
        throw new Error('Ajusta el contraste del diseño antes de generar el lote.');
      running = true;
      cancelled = false;
      el('batch-cancel').hidden = false;
      el('batch-progress').hidden = false;
      el('batch-progress').max = rows.length;
      el('batch-progress').value = 0;
      controls = Array.from(
        document.querySelectorAll(
          '.controls input,.controls textarea,.controls select,.controls button,#download,#reset',
        ),
      );
      controls = controls.filter((e) => e.id !== 'batch-cancel');
      disabled = controls.map((e) => e.disabled);
      controls.forEach((e) => (e.disabled = true));
      const files = {},
        report = [];
      let bytes = 0;
      for (let i = 0; i < rows.length; i++) {
        if (cancelled) break;
        const row = rows[i];
        el('batch-status').textContent = `Comprobando ${i + 1} / ${rows.length} · ${row.name}`;
        try {
          const payload = contentPayload(row.type, row.fields),
            qr = encodePayload(payload, {
              hasImage: !!options.image,
              ecc: options.image ? 'H' : studio.getState().ecc,
              imageModules: options.imageMode === 'center' ? options.imageModules : 0,
            }),
            svg = renderQrSvg(qr, options),
            check = await QRCheck.run(svg, payload, { isCurrent: () => !cancelled });
          if (cancelled) break;
          if (!check?.passed) throw new Error('No superó las cuatro lecturas. Ajusta el diseño.');
          let blob;
          if (format === 'svg')
            blob = new Blob([options.print.enabled ? physicalSvg(svg, options.print.width) : svg], {
              type: 'image/svg+xml',
            });
          else if (format === 'png')
            blob = await withDpi(
              await rasterizeQr(svg, options.size, 'image/png'),
              options.print.enabled ? options.print.dpi : null,
            );
          else {
            const { createStudioPdf } = await import('../export/studio-pdf.js');
            blob = await createStudioPdf(svg, options.print.enabled ? options.print.width : 50);
          }
          const data = new Uint8Array(await blob.arrayBuffer());
          bytes += data.length;
          if (bytes > 60_000_000)
            throw new Error('El ZIP supera 60 MB. Reduce el lote o el tamaño de las imágenes.');
          const filename =
            String(i + 1).padStart(3, '0') + '-' + safeFilename(row.name) + '.' + format;
          files[filename] = data;
          report.push({ name: row.name, type: row.type, file: filename, passed: true });
        } catch (error) {
          report.push({ name: row.name, type: row.type, passed: false, error: error.message });
        }
        el('batch-progress').value = i + 1;
      }
      if (cancelled) {
        el('batch-status').textContent = 'Lote cancelado. No se descargó ningún archivo.';
        return;
      }
      const passed = report.filter((r) => r.passed).length;
      if (!passed)
        throw new Error('Ningún QR superó la comprobación. Ajusta el diseño y vuelve a intentar.');
      const { zip, strToU8 } = await import('fflate');
      files['reporte.json'] = strToU8(JSON.stringify(report, null, 2));
      const zipBytes = await new Promise((resolve, reject) =>
        zip(files, { level: 4 }, (error, data) => (error ? reject(error) : resolve(data))),
      );
      saveFile(new Blob([zipBytes], { type: 'application/zip' }), 'zip', 'morphiq-qrs');
      el('batch-status').textContent =
        `${passed} QRs comprobados · ${report.length - passed} omitidos. El ZIP incluye el reporte.`;
    } catch (error) {
      el('batch-status').textContent = error.message;
    } finally {
      controls.forEach((e, i) => (e.disabled = disabled[i]));
      running = false;
      el('batch-cancel').hidden = true;
      studio.render();
    }
  });
}
