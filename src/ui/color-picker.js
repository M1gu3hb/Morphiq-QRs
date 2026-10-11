'use strict';
// The same color controls on desktop and mobile; no native color dialog.
export function initColorPicker() {
  const el = (id) => document.getElementById(id),
    panel = el('color-picker'),
    square = el('picker-square'),
    hue = el('picker-hue');
  const names = {
    foreground: 'Color del código',
    'eye-color': 'Color de las esquinas',
    background: 'Color de fondo',
    'logo-background': 'Base de la imagen',
  };
  let target = null,
    opener = null,
    h = 0,
    s = 0,
    v = 0,
    drag = null,
    previousOverflow = '';
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  function toHsv(hex) {
    const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((n) => parseInt(n, 16) / 255),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    let angle = h;
    if (d)
      angle = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
    return { h: (angle + 360) % 360, s: max ? d / max : 0, v: max };
  }
  function toHex() {
    const c = v * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = v - c;
    const rgb =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    return (
      '#' +
      rgb
        .map((n) =>
          Math.round((n + m) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  }
  function paint(emit = false) {
    const hex = toHex();
    square.style.setProperty('--hue', String(h));
    el('picker-cursor').style.left = s * 100 + '%';
    el('picker-cursor').style.top = (1 - v) * 100 + '%';
    square.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    square.setAttribute(
      'aria-valuetext',
      `Saturación ${Math.round(s * 100)}%, brillo ${Math.round(v * 100)}%`,
    );
    hue.value = String(Math.round(h));
    el('picker-hue-value').textContent = Math.round(h) + '°';
    el('picker-hex').value = hex.toUpperCase();
    el('picker-preview').style.backgroundColor = hex;
    hex
      .match(/[a-f\d]{2}/gi)
      .forEach(
        (n, i) => (el(['picker-r', 'picker-g', 'picker-b'][i]).value = String(parseInt(n, 16))),
      );
    el('picker-hex').setAttribute('aria-invalid', 'false');
    el('picker-error').textContent = '';
    if (emit && target) {
      el(target).value = hex;
      el(target).dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function readHex(hex, emit = true) {
    const hsv = toHsv(hex);
    h = hsv.h;
    s = hsv.s;
    v = hsv.v;
    paint(emit);
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.style.overflow = previousOverflow;
    opener?.setAttribute('aria-expanded', 'false');
    const button = opener;
    target = null;
    opener = null;
    drag = null;
    button?.focus();
  }
  function open(button) {
    if (!panel.hidden) close();
    opener = button;
    target = button.dataset.picker;
    el('picker-title').textContent = names[target];
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    readHex(el(target).value, false);
    square.focus();
  }
  function point(event) {
    const rect = square.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    v = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    paint(true);
  }
  document
    .querySelectorAll('[data-picker]')
    .forEach((button) => button.addEventListener('click', () => open(button)));
  square.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    drag = event.pointerId;
    square.setPointerCapture?.(event.pointerId);
    point(event);
    square.focus();
  });
  square.addEventListener('pointermove', (event) => {
    if (event.pointerId === drag) point(event);
  });
  const end = (event) => {
    if (event.pointerId !== drag) return;
    if (event.type === 'pointerup') point(event);
    drag = null;
  };
  square.addEventListener('pointerup', end);
  square.addEventListener('pointercancel', end);
  square.addEventListener('lostpointercapture', () => {
    drag = null;
  });
  square.addEventListener('keydown', (event) => {
    const delta = event.shiftKey ? 0.1 : 0.01;
    if (event.key === 'ArrowLeft') s -= delta;
    else if (event.key === 'ArrowRight') s += delta;
    else if (event.key === 'ArrowUp') v += delta;
    else if (event.key === 'ArrowDown') v -= delta;
    else return;
    event.preventDefault();
    s = clamp(s, 0, 1);
    v = clamp(v, 0, 1);
    paint(true);
  });
  hue.addEventListener('input', () => {
    h = clamp(Number(hue.value), 0, 360);
    paint(true);
  });
  function commitHex(allowShort = false) {
    let hex = el('picker-hex').value.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (allowShort && /^#[a-f\d]{3}$/i.test(hex))
      hex =
        '#' +
        hex
          .slice(1)
          .split('')
          .map((n) => n + n)
          .join('');
    if (/^#[a-f\d]{6}$/i.test(hex)) readHex(hex);
    else {
      el('picker-hex').setAttribute('aria-invalid', 'true');
      el('picker-error').textContent = 'Escribe un color HEX válido.';
    }
  }
  el('picker-hex').addEventListener('input', () => commitHex());
  el('picker-hex').addEventListener('change', () => commitHex(true));
  el('picker-hex').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commitHex(true);
  });
  ['picker-r', 'picker-g', 'picker-b'].forEach((id) =>
    el(id).addEventListener('input', () => {
      const rgb = ['picker-r', 'picker-g', 'picker-b'].map((key) => el(key).value);
      if (rgb.some((n) => n.trim() === '' || !Number.isFinite(Number(n)))) return;
      readHex(
        '#' +
          rgb
            .map((n) =>
              Math.round(clamp(Number(n), 0, 255))
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
      );
    }),
  );
  document
    .querySelectorAll('[data-picker-preset]')
    .forEach((button) =>
      button.addEventListener('click', () => readHex(button.dataset.pickerPreset)),
    );
  el('picker-close').addEventListener('click', close);
  el('picker-done').addEventListener('click', close);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) close();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = Array.from(panel.querySelectorAll('button,[tabindex="0"],input')).filter(
        (node) => !node.disabled,
      ),
      first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
