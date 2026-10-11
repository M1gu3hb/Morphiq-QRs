const paths = {
  url: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  text: '<path d="M4 5h16M4 10h16M4 15h10M4 20h8"/>',
  whatsapp:
    '<path d="M21 11.5a9 9 0 0 1-13.4 8L3 21l1.5-4.6A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-1 5 3 9 8 9l1-3-3-1-1 1-2-2 1-1-1-3Z"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
  contact:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="10" cy="9" r="3"/><path d="M5 18c1-6 9-6 10 0M17 8h2m-2 4h2"/>',
  phone: '<path d="M7 3H4C1 15 10 23 21 20v-4l-5-2-2 3-7-7 3-2Z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
  event:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/>',
  spotify:
    '<circle cx="12" cy="12" r="10"/><path d="M5 9c5-2 9-2 14 1M6 13c4-2 8-1 12 1M8 17c3-1 5-1 8 0"/>',
  social:
    '<circle cx="5" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 11 7-4M8 13l7 4"/>',
  app: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
  map: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  sms: '<path d="M21 4H3v14h4v4l5-4h9ZM7 8h10M7 12h7"/>',
  facebook: '<path d="M14 22V12h4l1-4h-5V5c0-2 1-2 4-2V0h-3c-5 0-6 3-6 6v2H6v4h3v10"/>',
  instagram:
    '<rect x="2" y="2" width="20" height="20" rx="6"/><circle cx="12" cy="12" r="5"/><circle cx="18" cy="6" r="1"/>',
  youtube: '<rect x="1" y="4" width="22" height="16" rx="5"/><path d="m9 8 7 4-7 4Z"/>',
  random: '<path d="M3 5h3l12 14h3M3 19h3L18 5h3m-3-3 3 3-3 3m0 8 3 3-3 3"/>',
  scan: '<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M2 12h20"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.url}</svg>`;
}
export function logoImage(name, color = '#000000') {
  return (
    'data:image/svg+xml;base64,' +
    btoa(
      icon(name)
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ')
        .replace('currentColor', color),
    )
  );
}
