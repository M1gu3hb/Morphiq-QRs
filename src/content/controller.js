import { contentPayload, withCampaign } from './payloads.js';
import { icon } from '../ui/icons.js';

export const TYPES = [
  ['url', 'Liga'],
  ['whatsapp', 'WhatsApp'],
  ['wifi', 'Wi-Fi'],
  ['contact', 'Contacto'],
  ['phone', 'Teléfono'],
  ['email', 'Correo'],
  ['event', 'Evento'],
  ['spotify', 'Spotify'],
  ['social', 'Red social'],
  ['app', 'Aplicación'],
  ['map', 'Ubicación'],
  ['text', 'Texto'],
  ['sms', 'SMS'],
];
export const FIELDS = {
  whatsapp: [
    ['phone', 'Teléfono con país', 'tel', '521234567890'],
    ['message', 'Mensaje', 'textarea', 'Hola, quiero información.'],
  ],
  wifi: [
    ['ssid', 'Nombre de la red', 'text', ''],
    ['security', 'Seguridad', 'select', 'WPA|WEP|nopass'],
    ['password', 'Contraseña', 'password', ''],
    ['hidden', 'Red oculta', 'checkbox', ''],
  ],
  contact: [
    ['name', 'Nombre completo', 'text', ''],
    ['company', 'Empresa', 'text', ''],
    ['phone', 'Teléfono con país', 'tel', ''],
    ['email', 'Correo', 'email', ''],
    ['url', 'Sitio web', 'url', ''],
    ['address', 'Dirección', 'text', ''],
  ],
  phone: [['phone', 'Teléfono con país', 'tel', '']],
  sms: [
    ['phone', 'Teléfono con país', 'tel', ''],
    ['message', 'Mensaje', 'textarea', ''],
  ],
  email: [
    ['email', 'Correo', 'email', ''],
    ['subject', 'Asunto', 'text', ''],
    ['message', 'Mensaje', 'textarea', ''],
  ],
  event: [
    ['title', 'Nombre del evento', 'text', ''],
    ['start', 'Inicio · hora local', 'datetime-local', ''],
    ['end', 'Final · hora local', 'datetime-local', ''],
    ['location', 'Ubicación', 'text', ''],
    ['description', 'Descripción', 'textarea', ''],
  ],
  spotify: [['url', 'Liga de Spotify', 'url', 'https://open.spotify.com/track/…']],
  social: [
    ['platform', 'Plataforma', 'select', 'instagram|facebook|youtube|tiktok|x|linkedin'],
    ['handle', 'Usuario o liga completa', 'text', '@tuusuario'],
  ],
  app: [['url', 'Liga de App Store, Google Play o web', 'url', 'https://']],
  map: [['address', 'Dirección o coordenadas', 'text', '']],
  text: [['text', 'Texto', 'textarea', '']],
};
export function createContentController(onChange) {
  const el = (id) => document.getElementById(id);
  let type = 'url';
  el('content-types').innerHTML = TYPES.map(
    ([id, name]) =>
      `<button type="button" data-content="${id}" aria-pressed="${id === 'url'}">${icon(id)}<span>${name}</span></button>`,
  ).join('');
  el('content-fields').innerHTML = Object.entries(FIELDS)
    .map(
      ([id, fields]) =>
        `<div data-content-panel="${id}" hidden class="content-form">${fields
          .map(([key, name, kind, placeholder]) => {
            const inputId = `content-${id}-${key}`;
            if (kind === 'checkbox')
              return `<label class="switch-label"><input type="checkbox" id="${inputId}">${name}</label>`;
            const input =
              kind === 'textarea'
                ? `<textarea id="${inputId}" rows="2" maxlength="1800" placeholder="${placeholder}"></textarea>`
                : kind === 'select'
                  ? `<select id="${inputId}">${placeholder
                      .split('|')
                      .map(
                        (v) =>
                          `<option value="${v}">${v === 'nopass' ? 'Sin contraseña' : v}</option>`,
                      )
                      .join('')}</select>`
                  : `<input id="${inputId}" type="${kind}" maxlength="500" placeholder="${placeholder}" autocomplete="off">`;
            return `<label class="select-label" for="${inputId}">${name}</label>${input}`;
          })
          .join('')}</div>`,
    )
    .join('');
  function select(next, emit = true) {
    type = TYPES.some(([id]) => id === next) ? next : 'url';
    el('url-content').hidden = type !== 'url';
    document
      .querySelectorAll('[data-content-panel]')
      .forEach((p) => (p.hidden = p.dataset.contentPanel !== type));
    document
      .querySelectorAll('[data-content]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.content === type)));
    el('campaign-available').hidden = ![
      'url',
      'app',
      'spotify',
      'social',
      'whatsapp',
      'map',
    ].includes(type);
    if (emit) onChange();
  }
  document
    .querySelectorAll('[data-content]')
    .forEach((b) => b.addEventListener('click', () => select(b.dataset.content)));
  el('content-fields').addEventListener('input', onChange);
  el('content-fields').addEventListener('change', onChange);
  const getFields = () =>
    type === 'url'
      ? { url: el('url').value }
      : Object.fromEntries(
          FIELDS[type].map(([key, , ,]) => {
            const input = el(`content-${type}-${key}`);
            return [key, input.type === 'checkbox' ? input.checked : input.value];
          }),
        );
  return {
    get type() {
      return type;
    },
    select,
    getFields,
    payload() {
      return withCampaign(contentPayload(type, getFields()), {
        enabled: !el('campaign-available').hidden && el('campaign-enabled').checked,
        source: el('utm-source').value,
        medium: el('utm-medium').value,
        campaign: el('utm-campaign').value,
        content: el('utm-content').value,
      });
    },
  };
}
