import { escapeXml } from '../qr/color-effects.js';
export const FRAMES = [
  ['band', 'Banda'],
  ['top', 'Cabecera'],
  ['outline', 'Contorno'],
  ['corners', 'Esquinas'],
  ['ticket', 'Boleto'],
  ['ribbon', 'Listón'],
  ['speech', 'Conversación'],
  ['circle', 'Órbita'],
  ['side', 'Lateral'],
  ['badge', 'Insignia'],
  ['notch', 'Etiqueta'],
  ['minimal', 'Línea'],
  ['double', 'Doble borde'],
  ['rounded', 'Tarjeta'],
].map(([id, name]) => ({ id, name }));
export function frameSvg(svg, options) {
  const f = options.border;
  if (!f?.enabled) return svg;
  const match = svg.match(/viewBox="([^\"]+)"/);
  const n = Number(match[1].split(' ')[2]);
  const body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  const unit = n / 100,
    pad = 8 * unit,
    label = 20 * unit;
  let w = n + pad * 2,
    h = n + pad * 2 + label,
    x = pad,
    y = pad;
  if (f.type === 'top') y += label;
  if (f.type === 'side') {
    w += label * 2.2;
    h -= label;
  }
  if (f.type === 'circle') {
    w = h = n * 1.55;
    x = y = (w - n) / 2;
  }
  if (f.type === 'speech') h += 5 * unit;
  const ink = f.color || '#123ca3',
    bg = options.background,
    txt = escapeXml((f.text || 'Escanéame').slice(0, 60));
  const rx = f.type === 'outline' || f.type === 'double' ? 2 * unit : 7 * unit;
  let decoration = '',
    ty = h - 8 * unit,
    tx = w / 2,
    textFill = f.textColor || '#ffffff';
  if (['band', 'top', 'rounded', 'ribbon', 'speech', 'badge'].includes(f.type)) {
    decoration = `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${ink}"/>`;
    if (f.type === 'speech')
      decoration += `<path d="M${w * 0.65} ${h - 6 * unit}l${-14 * unit} 0 0 ${6 * unit}Z" fill="${ink}"/>`;
    if (f.type === 'ribbon')
      decoration = `<path d="M0 0H${w}V${h}L${w / 2} ${h - 6 * unit} 0 ${h}Z" fill="${ink}"/>`;
    if (f.type === 'top') ty = 14 * unit;
  } else if (f.type === 'circle') {
    decoration = `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 1}" fill="${bg}" stroke="${ink}" stroke-width="${2 * unit}"/>`;
    ty = h - 7 * unit;
    textFill = ink;
  } else if (f.type === 'ticket') {
    decoration = `<path d="M0 0H${w}V${h * 0.38}Q${w - 6 * unit} ${h * 0.45} ${w} ${h * 0.52}V${h}H0V${h * 0.52}Q${6 * unit} ${h * 0.45} 0 ${h * 0.38}Z" fill="${ink}"/>`;
  } else if (f.type === 'side') {
    decoration = `<rect width="${w}" height="${h}" rx="${rx}" fill="${ink}"/>`;
    tx = n + pad * 2 + label;
    ty = h / 2;
  } else if (f.type === 'notch') {
    decoration = `<path d="M${7 * unit} 0H${w - 7 * unit}L${w} ${7 * unit}V${h - 7 * unit}L${w - 7 * unit} ${h}H${7 * unit}L0 ${h - 7 * unit}V${7 * unit}Z" fill="${bg}" stroke="${ink}" stroke-width="${1.5 * unit}"/>`;
    textFill = ink;
  } else {
    decoration = `<rect x="${unit}" y="${unit}" width="${w - 2 * unit}" height="${h - 2 * unit}" rx="${rx}" fill="${bg}" stroke="${ink}" stroke-width="${1.5 * unit}"/>`;
    textFill = ink;
    if (f.type === 'double')
      decoration += `<rect x="${4 * unit}" y="${4 * unit}" width="${w - 8 * unit}" height="${h - 8 * unit}" rx="${rx}" fill="none" stroke="${ink}" stroke-width="${unit * 0.7}"/>`;
    if (f.type === 'corners')
      decoration = `<rect width="${w}" height="${h}" fill="${bg}"/><path d="M0 ${16 * unit}V0H${16 * unit}M${w - 16 * unit} 0H${w}V${16 * unit}M0 ${h - 16 * unit}V${h}H${16 * unit}M${w - 16 * unit} ${h}H${w}V${h - 16 * unit}" fill="none" stroke="${ink}" stroke-width="${2 * unit}"/>`;
    if (f.type === 'minimal')
      decoration = `<rect width="${w}" height="${h}" fill="${bg}"/><path d="M${pad} ${h - label + unit}H${w - pad}" stroke="${ink}" stroke-width="${unit}"/>`;
  }
  const fontsize = Math.max(
    1.8 * unit,
    Math.min(7 * unit, (f.type === 'side' ? label * 3 : n) / (Math.max(8, txt.length) * 0.62)),
  );
  const transform = f.type === 'side' ? ` transform="rotate(-90 ${tx} ${ty})"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${Math.round((options.size * h) / w)}" viewBox="0 0 ${w} ${h}">${decoration}<g transform="translate(${x} ${y})">${body}</g><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${fontsize}" fill="${textFill}"${transform}>${txt}</text></svg>`;
}
