const el = (id) => document.getElementById(id);
export const EXTRA_DEFAULTS = {
  'advanced-enabled': false,
  'gradient-mode': 'none',
  'gradient-color': '#123ca3',
  'gradient-angle': '90',
  'border-enabled': false,
  'border-type': 'band',
  'border-text': 'Escanéame',
  'border-text-secondary': 'Abre tu cámara',
  'border-text-footer': 'morphiq.com.mx',
  'border-font': 'auto',
  'border-gradient': false,
  'border-accent-color': '#337cff',
  'border-color': '#123ca3',
  'border-text-color': '#ffffff',
  'silhouette-enabled': false,
  'campaign-enabled': false,
  'utm-source': '',
  'utm-medium': '',
  'utm-campaign': '',
  'utm-content': '',
  'print-enabled': false,
  'print-width': '50',
  'print-dpi': '300',
  'image-mode': 'center',
};
export function readAdvancedOptions(silhouette = null) {
  return {
    gradient: {
      mode: el('gradient-mode')?.value || 'none',
      color: el('gradient-color')?.value || '#123ca3',
      angle: Number(el('gradient-angle')?.value || 90),
    },
    border: {
      enabled: el('border-enabled')?.checked || false,
      type: el('border-type')?.value || 'band',
      text: el('border-text')?.value ?? 'Escanéame',
      textSecondary: el('border-text-secondary')?.value ?? 'Abre tu cámara',
      textFooter: el('border-text-footer')?.value ?? 'morphiq.com.mx',
      font: el('border-font')?.value || 'auto',
      gradient: el('border-gradient')?.checked || false,
      accentColor: el('border-accent-color')?.value || '#337cff',
      color: el('border-color')?.value || '#123ca3',
      textColor: el('border-text-color')?.value || '#ffffff',
    },
    silhouette: el('silhouette-enabled')?.checked ? silhouette : null,
    imageMode: el('image-mode')?.value || 'center',
    panMode: 'modules',
    print: {
      enabled: el('print-enabled')?.checked || false,
      width: Math.max(15, Math.min(200, Number(el('print-width')?.value) || 50)),
      dpi: Number(el('print-dpi')?.value) || 300,
    },
  };
}
export function resetAdvanced() {
  for (const [id, value] of Object.entries(EXTRA_DEFAULTS)) {
    const node = el(id);
    if (!node) continue;
    if (node.type === 'checkbox') node.checked = value;
    else node.value = value;
  }
}
