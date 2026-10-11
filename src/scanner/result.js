export function scanResult(payload) {
  if (/^https?:\/\//i.test(payload)) {
    try {
      const url = new URL(payload);
      if (['http:', 'https:'].includes(url.protocol))
        return {
          kind: 'Enlace',
          content: payload,
          href: url.href,
          action: 'Abrir ' + url.hostname,
        };
    } catch {}
  }
  if (/^tel:\+?\d{7,15}$/i.test(payload))
    return { kind: 'Teléfono', content: payload.slice(4), href: payload, action: 'Llamar' };
  if (/^mailto:/i.test(payload)) {
    let email;
    try {
      email = decodeURIComponent(payload.slice(7).split('?')[0]);
    } catch {
      email = '';
    }
    if (!/[\r\n]/.test(payload) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return {
        kind: 'Correo',
        content: email,
        href: payload,
        action: 'Escribir correo',
      };
  }
  if (/^WIFI:/i.test(payload)) {
    const fields = {};
    let key = '',
      value = '',
      readingKey = true,
      escaped = false;
    for (const c of payload.slice(5)) {
      if (escaped) {
        readingKey ? (key += c) : (value += c);
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === ':' && readingKey) {
        readingKey = false;
        continue;
      }
      if (c === ';') {
        if (key) fields[key] = value;
        key = '';
        value = '';
        readingKey = true;
        continue;
      }
      if (readingKey) key += c;
      else value += c;
    }
    return {
      kind: 'Red Wi-Fi',
      content: `Red: ${fields.S || '—'}\nSeguridad: ${fields.T || '—'}\nContraseña: ${fields.P || 'Sin contraseña'}`,
    };
  }
  if (/^BEGIN:VCARD/i.test(payload))
    return { kind: 'Contacto', content: payload, download: 'vcf', mime: 'text/vcard' };
  if (/^BEGIN:VCALENDAR/i.test(payload))
    return { kind: 'Evento', content: payload, download: 'ics', mime: 'text/calendar' };
  if (/^SMSTO:/i.test(payload)) return { kind: 'Mensaje SMS', content: payload.slice(6) };
  return { kind: 'Texto', content: payload };
}
