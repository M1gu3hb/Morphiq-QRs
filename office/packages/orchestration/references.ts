const primaryHosts = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'api.github.com',
  'registry.npmjs.org',
  'developer.android.com',
  'developer.chrome.com',
  'developer.mozilla.org',
  'capacitorjs.com',
  'capawesome.io',
  'www.nayuki.io',
  'bwip-js.metafloor.com',
  'vite.dev',
  'sec-ant.github.io',
  'zxing-cpp.github.io',
  'nodejs.org',
  'code.claude.com',
  'platform.claude.com',
]);
export function referenceURL(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !primaryHosts.has(url.hostname) ||
    /sk-ant-|gh[pousr]_/.test(value)
  )
    throw new Error('Solo fuentes primarias HTTPS públicas sin credenciales');
  return url;
}
export async function fetchReference(value: string) {
  let url = referenceURL(value);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'text/plain, application/json, text/html' },
    });
    if (response.status >= 300 && response.status < 400) {
      url = referenceURL(new URL(response.headers.get('location') ?? '', url).href);
      continue;
    }
    const reader = response.body?.getReader();
    let content = '',
      length = 0;
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (length < 48000) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          length += chunk.length;
          content += decoder.decode(chunk, { stream: true });
        }
      } finally {
        await reader.cancel();
      }
    }
    return {
      url: url.href,
      status: response.status,
      content: content.slice(0, 32000),
      truncated: length >= 48000,
    };
  }
  throw new Error('Demasiadas redirecciones');
}
