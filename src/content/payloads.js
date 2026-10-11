import { normalizeLink } from '../qr/encoder.js';

const required = (value, name) => {
  const text = String(value || '').trim();
  if (!text) throw new Error('Completa ' + name + '.');
  return text;
};
const escape = (value) =>
  String(value || '')
    .replace(/([\\;,:])/g, '\\$1')
    .replace(/\r?\n/g, '\\n');
export function phoneNumber(value) {
  const phone = required(value, 'el teléfono').replace(/[\s()+.-]/g, '');
  if (!/^\d{7,15}$/.test(phone)) throw new Error('Usa el número completo con código de país.');
  return phone;
}
export function contentPayload(type, fields) {
  const f = fields;
  switch (type) {
    case 'url':
    case 'app':
      return normalizeLink(required(f.url, 'la liga'));
    case 'text':
      return required(f.text, 'el texto');
    case 'whatsapp':
      return (
        'https://wa.me/' +
        phoneNumber(f.phone) +
        (f.message ? '?text=' + encodeURIComponent(f.message) : '')
      );
    case 'phone':
      return 'tel:+' + phoneNumber(f.phone);
    case 'sms':
      return 'SMSTO:+' + phoneNumber(f.phone) + ':' + (f.message || '');
    case 'wifi': {
      const ssid = required(f.ssid, 'el nombre de la red');
      const auth = ['WPA', 'WEP', 'nopass'].includes(f.security) ? f.security : 'WPA';
      if (auth !== 'nopass') required(f.password, 'la contraseña');
      return `WIFI:T:${auth};S:${escape(ssid)};P:${auth === 'nopass' ? '' : escape(f.password)};H:${f.hidden ? 'true' : 'false'};;`;
    }
    case 'email': {
      const email = required(f.email, 'el correo');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Revisa el correo.');
      return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(f.subject || '')}&body=${encodeURIComponent(f.message || '')}`;
    }
    case 'contact': {
      const name = required(f.name, 'el nombre');
      const values = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:' + escape(name),
        'N:' + escape(name) + ';;;;',
      ];
      if (f.company) values.push('ORG:' + escape(f.company));
      if (f.phone) values.push('TEL;TYPE=CELL:+' + phoneNumber(f.phone));
      if (f.email) values.push('EMAIL:' + escape(f.email));
      if (f.url) values.push('URL:' + normalizeLink(f.url));
      if (f.address) values.push('ADR:;;' + escape(f.address) + ';;;;');
      return values.concat('END:VCARD').join('\r\n');
    }
    case 'event': {
      const title = required(f.title, 'el nombre del evento');
      const start = new Date(required(f.start, 'el inicio'));
      const end = new Date(required(f.end, 'el final'));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
        throw new Error('El final debe ser posterior al inicio.');
      const date = (d) =>
        d
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Morphiq//QR//ES',
        'BEGIN:VEVENT',
        'UID:' + start.getTime() + '-' + encodeURIComponent(title) + '@morphiq',
        'DTSTAMP:' + date(start),
        'DTSTART:' + date(start),
        'DTEND:' + date(end),
        'SUMMARY:' + escape(title),
        'LOCATION:' + escape(f.location),
        'DESCRIPTION:' + escape(f.description),
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    }
    case 'spotify': {
      const url = new URL(normalizeLink(required(f.url, 'la liga de Spotify')));
      if (
        url.hostname !== 'open.spotify.com' ||
        !/^\/(track|album|playlist|artist|episode|show)\/[\w]+/.test(url.pathname)
      )
        throw new Error('Pega una liga de canción, álbum, playlist o artista de open.spotify.com.');
      return url.href;
    }
    case 'social': {
      if (/^https?:\/\//i.test(f.handle || '')) return normalizeLink(f.handle);
      const bases = {
        instagram: 'https://instagram.com/',
        facebook: 'https://facebook.com/',
        youtube: 'https://youtube.com/@',
        tiktok: 'https://tiktok.com/@',
        x: 'https://x.com/',
        linkedin: 'https://linkedin.com/in/',
      };
      return (
        (bases[f.platform] || bases.instagram) +
        encodeURIComponent(required(f.handle, 'el usuario').replace(/^@/, ''))
      );
    }
    case 'map':
      return (
        'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(required(f.address, 'la dirección'))
      );
    default:
      throw new Error('Elige un tipo de contenido.');
  }
}

export function withCampaign(payload, fields) {
  if (!fields.enabled) return payload;
  if (!/^https?:\/\//i.test(payload))
    throw new Error('Las etiquetas de campaña requieren una liga web.');
  const url = new URL(payload);
  for (const [key, value] of Object.entries({
    utm_source: fields.source,
    utm_medium: fields.medium,
    utm_campaign: fields.campaign,
    utm_content: fields.content,
  })) {
    if (value?.trim()) url.searchParams.set(key, value.trim());
  }
  return url.href;
}
