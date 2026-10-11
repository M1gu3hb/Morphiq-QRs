export function namespaceSvg(markup, prefix) {
  const ids = Array.from(markup.matchAll(/\bid="([^\"]+)"/g), (m) => m[1]);
  for (const id of ids) {
    markup = markup
      .replaceAll(`id="${id}"`, `id="${prefix}-${id}"`)
      .replaceAll(`url(#${id})`, `url(#${prefix}-${id})`);
  }
  return markup;
}
