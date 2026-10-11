export function luminance(hex) {
  const c = hex
    .match(/[a-f\d]{2}/gi)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function hasReadableColors(foreground, eyes, background) {
  const bg = luminance(background);
  return [foreground, eyes].every((color) => {
    const fg = luminance(color);
    return bg > fg && (bg + 0.05) / (fg + 0.05) >= 4.5;
  });
}
