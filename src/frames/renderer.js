import { escapeXml } from '../qr/color-effects.js';
import { getFrame } from './catalog.js';

// Canonical 100-unit artwork is scaled to the original QR matrix units.
// The QR stays intact and decorations never enter its quiet zone.
export function frameSvg(svg, options) {
  const f = options.border;
  if (!f?.enabled) return svg;
  const view = svg
      .match(/viewBox="([^"]+)"/)[1]
      .split(' ')
      .map(Number),
    u = view[2] / 100,
    body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')),
    meta = getFrame(f.type),
    type = meta.id,
    ink = f.color || '#123ca3',
    accent = f.accentColor || '#337cff',
    bg = options.background || '#ffffff',
    light = f.textColor || '#ffffff',
    primary = f.text ?? meta.example[0],
    secondary = f.textSecondary ?? meta.example[1],
    footer = f.textFooter ?? meta.example[2],
    fill = f.gradient ? 'url(#frame-gradient)' : ink;
  let w = 116,
    h = 140,
    x = 8,
    y = 8,
    left = 0,
    decoration = '',
    captions = '';
  const rect = (xx, yy, ww, hh, color, radius = 0, stroke = null, sw = 1.5) =>
    `<rect x="${xx}" y="${yy}" width="${ww}" height="${hh}" rx="${radius}" fill="${color}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  const path = (d, color = fill, stroke = null, sw = 1.5) =>
    `<path d="${d}" fill="${color}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : ''}/>`;
  const circle = (cx, cy, r, color, stroke = null, sw = 1.5) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  const font =
    {
      sans: 'Arial, sans-serif',
      serif: 'Georgia, serif',
      mono: 'Courier New, monospace',
      script: 'cursive',
    }[f.font] || (['ribbon', 'wave-gradient'].includes(type) ? 'cursive' : 'Arial, sans-serif');
  function text(value, tx, ty, width, color = light, size = 7, maxLines = 2, rotation = 0) {
    const lines = String(value ?? '')
      .slice(0, 140)
      .split('\n')
      .slice(0, maxLines);
    if (!lines.some((line) => line.trim())) return '';
    const largest = Math.max(...lines.map((line) => Array.from(line).length), 1),
      fs = Math.max(2, Math.min(size, width / (largest * 0.62))),
      lineHeight = fs * 1.15,
      start = ty - ((lines.length - 1) * lineHeight) / 2;
    return `<text x="${tx}" y="${start}" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-weight="700" font-size="${fs}" fill="${color}"${rotation ? ` transform="rotate(${rotation} ${tx} ${ty})"` : ''}>${lines.map((line, i) => `<tspan x="${tx}" y="${start + i * lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`;
  }
  function phone(px, py, ww, hh, color = light, sw = 1.5) {
    return (
      rect(px, py, ww, hh, 'none', 3, color, sw) +
      path(
        `M${px + ww * 0.36} ${py + 3}h${ww * 0.28}M${px + ww * 0.44} ${py + hh - 3}h${ww * 0.12}`,
        'none',
        color,
        sw * 0.7,
      )
    );
  }
  function brackets(xx, yy, ww, hh, color = ink) {
    return path(
      `M${xx} ${yy + 13}V${yy}h13M${xx + ww - 13} ${yy}h13v13M${xx} ${yy + hh - 13}v13h13M${xx + ww - 13} ${yy + hh}h13v-13`,
      'none',
      color,
      2,
    );
  }
  switch (type) {
    case 'band':
    case 'rounded':
    case 'top':
      decoration = rect(0, 0, w, h, fill, type === 'rounded' ? 14 : 5);
      if (type === 'top') {
        y = 32;
        captions = text(primary, 58, 16, 98);
      } else captions = text(primary, 58, 125, 98);
      break;
    case 'outline':
    case 'double':
    case 'notch':
    case 'minimal':
    case 'corners':
      decoration =
        type === 'notch'
          ? path('M7 1H109L115 7V133L109 139H7L1 133V7Z', bg, ink)
          : rect(1, 1, 114, 138, bg, 2, ink);
      if (type === 'double') decoration += rect(4, 4, 108, 132, 'none', 1, ink, 0.7);
      if (type === 'minimal') decoration = path('M8 114H108', 'none', ink, 1);
      if (type === 'corners') decoration = brackets(1, 1, 114, 138);
      captions = text(primary, 58, 125, 95, ink);
      break;
    case 'side':
      w = 142;
      h = 116;
      decoration = rect(0, 0, w, h, fill, 7);
      captions = text(primary, 126, 58, 94, light, 8, 2, -90);
      break;
    case 'ticket':
      decoration = path(
        'M4 0H112Q116 0 116 4V54a7 7 0 0 0 0 14V136Q116 140 112 140H4Q0 140 0 136V68a7 7 0 0 0 0-14V4Q0 0 4 0Z',
      );
      captions = text(primary, 58, 125, 96);
      break;
    case 'ticket-wide':
      w = 160;
      h = 116;
      x = 54;
      decoration = path(
        'M0 0H50a5 5 0 0 0 10 0H160V27a7 7 0 0 0 0 14V75a7 7 0 0 0 0 14V116H60a5 5 0 0 0-10 0H0V78a10 10 0 0 0 0-20Z',
      );
      decoration += `<path d="M43 6V110" stroke="${light}" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 5"/>`;
      captions = text(primary, 21, 58, 88, light, 10, 2, -90);
      break;
    case 'ribbon':
      h = 150;
      decoration = path('M0 0H116V150L58 135 0 150Z');
      captions = text(primary, 58, 122, 94, light, 8);
      break;
    case 'badge':
      h = 145;
      decoration = path('M0 0H116V128L58 145 0 128Z');
      captions = text(primary, 58, 121, 92);
      break;
    case 'wave-stamp':
      h = 146;
      decoration = path(
        'M0 4Q0 0 4 0H112Q116 0 116 4V140q-4-12-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-8 0t-12 0V4Z',
      );
      captions = text(primary, 58, 123, 94, light, 8);
      break;
    case 'wave-gradient':
      h = 149;
      decoration = path('M1 1H115V136Q87 153 58 143T1 138Z', fill, ink, 1.5);
      decoration += path(
        'M4 138Q30 151 58 140T112 134M4 133Q31 146 58 135T112 129',
        'none',
        light,
        1.2,
      );
      captions = text(primary, 58, 121, 94, light, 7.5);
      break;
    case 'speech':
    case 'bubble-outline':
      h = 155;
      decoration = path(
        'M18 2H98Q114 2 114 18V112Q114 129 98 129H77Q71 145 45 153L51 129H18Q2 129 2 112V18Q2 2 18 2Z',
        type === 'speech' ? fill : bg,
        type === 'speech' ? null : ink,
        3,
      );
      captions = text(primary, 58, 119, 92, type === 'speech' ? light : ink, 6.5);
      break;
    case 'circle':
    case 'circle-dots':
    case 'organic':
      w = h = 160;
      x = y = 30;
      decoration =
        type === 'organic'
          ? path(
              'M80 2C104-4 114 21 132 28S164 44 156 71s10 43-16 56-25 38-53 28-45 12-58-20S-1 106 4 78s-7-43 23-51S51 1 80 2Z',
            )
          : circle(80, 80, 78, bg, ink, type === 'circle' ? 2 : 1.5);
      if (type === 'circle-dots')
        for (let i = 0; i < 60; i++) {
          const a = (i * Math.PI * 2) / 60;
          decoration += circle(80 + Math.cos(a) * 73, 80 + Math.sin(a) * 73, 0.7, ink);
        }
      captions = text(primary, 80, 143, 88, type === 'organic' ? light : ink, 7);
      break;
    case 'circle-shadow':
      w = h = 160;
      x = 30;
      y = 27;
      decoration =
        circle(80, 80, 79, fill) + path('M130 26L159 69V104L103 158 30 128V26Z', '#00000055');
      captions = text(secondary, 80, 15, 73, light, 4.5, 1) + text(primary, 80, 143, 80, light, 7);
      break;
    case 'bookmark-circle':
      w = 142;
      h = 220;
      x = 21;
      y = 43;
      decoration =
        path('M20 0H122V220L71 181 20 220Z') +
        circle(71, 93, 69, bg, ink, 1.5) +
        rect(28, 165, 86, 22, bg, 11);
      captions = text(primary, 71, 176, 74, ink, 7);
      break;
    case 'discover-portrait':
      w = 132;
      h = 194;
      x = 16;
      y = 49;
      decoration = rect(0, 0, w, h, fill, 7);
      captions =
        text(primary, 66, 25, 102, light, 7.5, 3) +
        text(secondary, 66, 169, 105, light, 6, 1) +
        text(footer, 66, 184, 108, light, 4, 2);
      decoration +=
        path('M24 157H51M81 157H108', 'none', light, 0.6) + phone(60, 150, 12, 15, light, 1);
      break;
    case 'discover-landscape':
      w = 224;
      h = 124;
      x = 116;
      y = 12;
      decoration = rect(0, 0, w, h, fill, 8);
      captions =
        text(primary, 55, 27, 90, light, 7.5, 3) +
        text(secondary, 55, 79, 90, light, 5.5, 1) +
        text(footer, 55, 102, 88, light, 4, 3);
      decoration +=
        path('M15 59H38M72 59H95', 'none', light, 0.6) + phone(49, 48, 12, 20, light, 1);
      break;
    case 'scan-bold':
      h = 164;
      decoration = rect(0, 0, w, h, fill, 8);
      captions = text(primary, 58, 137, 94, light, 18, 2);
      break;
    case 'arrow-curved':
      w = 196;
      h = 125;
      x = 92;
      y = 10;
      decoration = path('M5 84C4 38 27 18 63 17V7L88 25 62 43V31C30 29 16 51 16 83Z');
      captions = text(primary, 46, 94, 76, ink, 14, 2);
      break;
    case 'bubble-top-right':
    case 'bubble-top-left':
      h = 140;
      y = 38;
      decoration = rect(1, 1, 114, 25, fill, 6);
      decoration += path(type === 'bubble-top-right' ? 'M77 25l13 13V25Z' : 'M11 25v13l13-13Z');
      captions = text(primary, 58, 14, 99, light, 8);
      break;
    case 'bubble-bottom':
      h = 139;
      y = 1;
      decoration = rect(8, 115, 100, 22, fill, 4) + path('M21 115v-13l13 13Z');
      captions = text(primary, 58, 127, 88, light, 8);
      break;
    case 'label-pointer':
      h = 145;
      y = 1;
      decoration =
        rect(8, 123, 100, 20, bg, 4, ink, 1.5) +
        path('M53 117l5-5 5 5M53 112l5-5 5 5', 'none', ink, 1) +
        phone(15, 128, 6, 10, ink, 0.8);
      captions = text(primary, 62, 133, 78, ink, 7);
      break;
    case 'banner-phone':
    case 'banner-compact':
      w = type === 'banner-phone' ? 218 : 207;
      left = 9;
      h = 116;
      x = w - 104;
      y = 8;
      decoration =
        rect(0, 0, w, h, fill, 8) +
        path('M0 39l-9 19 9 19Z') +
        phone(9, 12, 32, 83, light, type === 'banner-phone' ? 2 : 1.2);
      captions =
        text(primary, 79, 49, 65, light, 16, 2) + text(secondary, 77, 88, 60, light, 4.5, 2);
      break;
    case 'phone-side':
      w = 164;
      h = 142;
      x = 56;
      y = 22;
      decoration = phone(50, 1, 113, 139, ink, 2) + rect(0, 24, 43, 35, fill, 2);
      captions = text(primary, 21, 41, 37, light, 9, 2) + text(secondary, 21, 78, 40, ink, 5, 3);
      break;
    case 'brackets-side':
      w = 202;
      h = 116;
      x = 4;
      y = 8;
      decoration =
        brackets(1, 1, 110, 114) +
        rect(114, 27, 86, 62, fill, 5) +
        phone(119, 36, 17, 44, light, 1.2);
      captions =
        text(primary, 169, 48, 52, light, 9, 2) + text(secondary, 169, 77, 50, light, 4, 2);
      break;
    case 'phone-outline':
      w = 110;
      h = 150;
      x = 5;
      y = 21;
      decoration = phone(1, 1, 108, 148, ink, 2);
      captions = text(primary, 55, 132, 90, ink, 7);
      break;
    case 'label-bottom':
    case 'label-pill':
      h = 140;
      y = 2;
      decoration =
        rect(14, 116, 88, 20, fill, type === 'label-pill' ? 10 : 3) + text(primary, 58, 126, 78);
      break;
    case 'tab-top':
      h = 136;
      y = 28;
      decoration = rect(3, 23, 110, 111, bg, 2, ink, 2) + rect(8, 1, 100, 22, bg, 1, ink, 1.5);
      captions = text(primary, 58, 12, 91, ink, 8);
      break;
    case 'scan-label-outline':
      decoration =
        rect(1, 1, 114, 138, bg, 9, ink, 2) +
        phone(12, 118, 6, 11, ink, 0.8) +
        path('M22 125H29M90 125H103', 'none', ink, 0.8);
      captions = text(primary, 58, 125, 63, ink, 6.5);
      break;
    case 'inverse-caption':
      h = 146;
      y = 33;
      decoration = rect(0, 0, w, h, fill, 4) + rect(0, 0, w, 29, bg);
      captions = text(primary, 58, 14, 97, ink, 8);
      break;
    case 'pill-side':
      w = 230;
      h = 116;
      x = y = 8;
      decoration = rect(76, 22, 151, 72, bg, 11, ink, 2) + rect(0, 0, 116, 116, fill, 8);
      captions = text(primary, 171, 58, 96, ink, 10);
      break;
    case 'shield-label':
      h = 145;
      y = 4;
      decoration =
        path('M14 96H102L114 102V131L58 145 2 131V102Z') + brackets(8, 112, 100, 18, light);
      captions = text(primary, 58, 122, 83, light, 8);
      break;
    case 'shield-outline':
      h = 152;
      y = 9;
      decoration = path(
        'M15 1H101Q115 1 115 15V128Q115 136 105 138L58 150 11 138Q1 136 1 128V15Q1 1 15 1Z',
        bg,
        ink,
        2,
      );
      captions = text(primary, 58, 125, 97, ink, 7);
      break;
  }
  decoration += rect(x - 2, y - 2, 104, 104, bg, 3);
  const defs = f.gradient
    ? `<defs><linearGradient id="frame-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${ink}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size || 1024}" height="${Math.round(((options.size || 1024) * h) / (w + left))}" viewBox="0 0 ${(w + left) * u} ${h * u}">${defs}<rect width="${(w + left) * u}" height="${h * u}" fill="${bg}"/><g transform="scale(${u})"><g transform="translate(${left} 0)">${decoration}${captions}</g></g><g transform="translate(${(x + left) * u} ${y * u})">${body}</g></svg>`;
}
