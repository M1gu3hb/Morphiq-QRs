import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { encodePayload } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';

async function camera(page, options = {}) {
  await page.addInitScript((settings) => {
    window.cameraCalls = [];
    window.cameraTracks = [];
    window.cameraPending = settings.pending;
    window.cameraError = settings.error || null;
    let userGesture = false;
    document.addEventListener(
      'click',
      () => {
        userGesture = true;
        setTimeout(() => {
          userGesture = false;
        }, 0);
      },
      true,
    );
    window.permissionState = settings.state || 'granted';
    const permission = new EventTarget();
    Object.defineProperty(permission, 'state', { get: () => window.permissionState });
    window.changePermission = (value) => {
      window.permissionState = value;
      permission.dispatchEvent(new Event('change'));
    };
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (description) => {
      if (description.name !== 'camera') return query(description);
      if (settings.unsupported) throw new TypeError('Unsupported permission');
      if (settings.pendingQuery)
        return new Promise((resolve) => {
          window.finishPermissionQuery = () => resolve(permission);
        });
      return permission;
    };
    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => visibility });
    Object.defineProperty(document, 'hidden', { get: () => visibility === 'hidden' });
    window.setVisibility = (value) => {
      visibility = value;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    if (settings.installed) Object.defineProperty(navigator, 'standalone', { value: true });
    if (settings.storageBlocked) {
      const get = Storage.prototype.getItem,
        set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'morphiq-camera') throw new DOMException('Blocked', 'SecurityError');
        return get.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === 'morphiq-camera') throw new DOMException('Blocked', 'SecurityError');
        return set.call(this, key, value);
      };
    }
    const makeStream = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const stream = canvas.captureStream(5);
      canvas.getContext('2d').fillRect(0, 0, 64, 64);
      const track = stream.getVideoTracks()[0];
      track.getCapabilities = () => ({ torch: true });
      track.applyConstraints = async () => {
        if (window.rejectTorch) throw new DOMException('Unsupported', 'OverconstrainedError');
      };
      window.cameraTracks.push(track);
      return stream;
    };
    window.makeCameraStream = makeStream;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.cameraCalls.push(constraints);
      if (settings.requireGesture && !userGesture)
        throw new DOMException('A user gesture is required', 'NotAllowedError');
      if (settings.rejectConstraints && constraints.video !== true)
        throw new DOMException('Unsupported constraints', 'OverconstrainedError');
      if (window.permissionState === 'denied') throw new DOMException('Denied', 'NotAllowedError');
      if (window.cameraPending)
        return new Promise((resolve) => {
          window.finishCamera = () => resolve(makeStream());
        });
      if (window.cameraError) throw new DOMException('Camera error', window.cameraError);
      if (window.permissionState === 'prompt') window.changePermission('granted');
      return makeStream();
    };
  }, options);
}
test('a dismissed request is remembered even when the browser cannot query camera permissions', async ({
  page,
}) => {
  await camera(page, { unsupported: true });
  await page.goto('/');
  await page.evaluate(() => {
    window.cameraError = 'NotAllowedError';
  });
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await expect(page.locator('#scanner-status')).toContainText('Permite la cámara');
  await background(page);
  await page.locator('#nav-studio').click();
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await page.goto('/?app=1');
  await expect(page.locator('#scanner-status')).toContainText('Permite la cámara');
  await calls(page, 0);
  await page.locator('#scanner-start').click();
  await calls(page, 1);
  await live(page);
});

test('a tap requests camera before losing its user activation', async ({ page }) => {
  await camera(page, { state: 'prompt', requireGesture: true, pendingQuery: true });
  await page.goto('/');
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await live(page);
});

test('a PWA rejected for missing user activation recovers with an explicit tap', async ({
  page,
}) => {
  await camera(page, { installed: true, state: 'prompt', requireGesture: true });
  await page.goto('/?app=1');
  await calls(page, 1);
  await expect(page.locator('#camera-recovery')).toBeVisible();
  await page.locator('#scanner-start').click();
  await calls(page, 2);
  await live(page);
  await expect(page.locator('#camera-recovery')).toBeHidden();
});

test('a reset permission clears an obsolete blocked preference', async ({ page }) => {
  await camera(page, { installed: true, state: 'prompt' });
  await page.addInitScript(() =>
    localStorage.setItem(
      'morphiq-camera',
      JSON.stringify({ automatic: true, used: false, blocked: true }),
    ),
  );
  await page.goto('/?app=1');
  await calls(page, 1);
  await live(page);
});

test('unsupported camera constraints fall back to a plain video request without audio', async ({
  page,
}) => {
  await camera(page, { rejectConstraints: true });
  await page.goto('/?app=1');
  await calls(page, 2);
  await live(page);
  expect(await page.evaluate(() => window.cameraCalls[1])).toEqual({ video: true, audio: false });
});

test('an unanswered camera request offers a working retry and releases the old stream', async ({
  page,
}) => {
  await camera(page, { pending: true });
  await page.clock.install();
  await page.goto('/?app=1');
  await calls(page, 1);
  await page.evaluate(() => {
    window.completeOldCamera = window.finishCamera;
  });
  await page.clock.fastForward(7100);
  await expect(page.locator('#camera-recovery-title')).toContainText('No aparece');
  await expect(page.locator('#scanner-start')).toBeEnabled();
  await page.evaluate(() => {
    window.cameraPending = false;
  });
  await page.locator('#scanner-start').click();
  await calls(page, 2);
  await live(page);
  await page.evaluate(() => window.completeOldCamera());
  await expect.poll(() => page.evaluate(() => window.cameraTracks[1].readyState)).toBe('ended');
  expect(await page.evaluate(() => window.cameraTracks[0].readyState)).toBe('live');
});

test('photographing a QR works without the live camera API and preserves its exact payload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined });
    Object.defineProperty(navigator, 'standalone', { value: true });
  });
  await page.goto('/?app=1');
  await expect(page.locator('#camera-recovery')).toBeVisible();
  await expect(page.locator('#camera-recovery-message')).toContainText('Chrome o Safari');
  const picker = page.waitForEvent('filechooser');
  await page.locator('#scanner-capture').click();
  const url = 'https://morphiq.com.mx/?camera=foto&exacto=1#qr';
  const png = await sharp(Buffer.from(renderQrSvg(encodePayload(url), { margin: 4, size: 900 })))
    .png()
    .toBuffer();
  await (await picker).setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: png });
  await expect(page.locator('#scan-content')).toHaveText(url);
  await expect(page.locator('#scan-open')).toHaveAttribute('href', url);
  await expect(page.locator('#scan-rebuilt svg')).toBeVisible();
  await expect(page.locator('#scan-share')).toBeEnabled();
  await expect(page.locator('#scanner-capture-file')).toHaveAttribute('capture', 'environment');
});

test('a stalled video playback remains recoverable and the old camera is released', async ({
  page,
}) => {
  await camera(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let first = true;
    HTMLMediaElement.prototype.play = function () {
      if (first) {
        first = false;
        return new Promise(() => {});
      }
      return play.call(this);
    };
  });
  await page.clock.install();
  await page.goto('/?app=1');
  await calls(page, 1);
  await page.clock.fastForward(7100);
  await expect(page.locator('#scanner-start')).toBeEnabled();
  await page.locator('#scanner-start').click();
  await calls(page, 2);
  await live(page);
  expect(await page.evaluate(() => window.cameraTracks[0].readyState)).toBe('ended');
});

test('camera recovery and the permission guide fit narrow and landscape screens', async ({
  page,
}, info) => {
  await camera(page, { state: 'denied' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?app=1');
  await expect(page.locator('#camera-recovery')).toBeVisible();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 667, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    const toolbar = await page.locator('.camera-toolbar').boundingBox();
    expect(toolbar.y).toBeGreaterThanOrEqual(60);
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator('#scanner-capture')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#camera-browser-open')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('camera-recovery-mobile.png') });
  await page.locator('#scanner-permissions').click();
  await page.locator('#camera-guide-platform').selectOption('android');
  await expect(page.locator('#camera-guide-installed')).toContainText('solo Notificaciones');
  await expect(page.locator('#camera-guide-open')).toHaveAttribute('href', /\?view=scan$/);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new DOMException('Clipboard blocked', 'NotAllowedError');
    };
  });
  await page.locator('#camera-guide-copy').click();
  await expect(page.locator('#camera-reader-link')).toBeVisible();
  await expect(page.locator('#camera-reader-link')).toHaveValue(/\?view=scan$/);
  await expect(page.locator('#camera-guide-note')).toContainText('Copiar');
  await page.screenshot({ path: info.outputPath('camera-guide-mobile.png') });
});

test('the reader link can be copied when clipboard access is available', async ({ page }) => {
  await camera(page, { state: 'denied' });
  await page.addInitScript(() => {
    navigator.clipboard.writeText = async (value) => {
      window.copiedReader = value;
    };
  });
  await page.goto('/?app=1');
  await page.locator('#scanner-permissions').click();
  await page.locator('#camera-guide-copy').click();
  await expect(page.locator('#camera-guide-copy')).toHaveText('Enlace copiado');
  expect(await page.evaluate(() => window.copiedReader)).toBe('http://127.0.0.1:4173/?view=scan');
  await expect(page.locator('#camera-reader-link')).toBeHidden();
});

async function nativeControl(page) {
  await camera(page, { state: 'denied' });
  await page.addInitScript(() => {
    window.HTMLUserMediaElement = class {};
    const create = document.createElement.bind(document);
    document.createElement = (tag, ...args) => {
      if (tag !== 'usermedia') return create(tag, ...args);
      const control = create('button');
      control.textContent = 'Autorizar cámara';
      control.setConstraints = (value) => {
        control.constraints = value;
      };
      return control;
    };
  });
}

test('a native permission recovery control supplies its stream without a duplicate request', async ({
  page,
}) => {
  await nativeControl(page);
  await page.goto('/?app=1');
  await page.locator('#scanner-permissions').click();
  await page.locator('#camera-native-guide button').click();
  await page.evaluate(() => {
    const control = document.querySelector('#camera-native-guide button');
    control.stream = window.makeCameraStream();
    control.dispatchEvent(new Event('stream'));
  });
  await live(page);
  await calls(page, 0);
  await expect(page.locator('#camera-permissions')).not.toBeVisible();
  expect(
    await page
      .locator('#camera-native-guide button')
      .evaluate((control) => control.constraints.audio),
  ).toBe(false);
});

test('a native stream received after leaving the reader is released', async ({ page }) => {
  await nativeControl(page);
  await page.goto('/?app=1');
  await page.locator('#camera-native-recovery button').click();
  await page.locator('#nav-studio').click();
  await page.evaluate(() => {
    const control = document.querySelector('#camera-native-recovery button');
    control.stream = window.makeCameraStream();
    control.dispatchEvent(new Event('stream'));
  });
  await expect.poll(() => page.evaluate(() => window.cameraTracks[0].readyState)).toBe('ended');
  await expect(page.locator('#studio-view')).toBeVisible();
});

test('a permission query finishing after leaving the reader cannot open the camera', async ({
  page,
}) => {
  await camera(page, { pendingQuery: true });
  await page.goto('/?app=1');
  await expect
    .poll(() => page.evaluate(() => typeof window.finishPermissionQuery))
    .toBe('function');
  await page.locator('#nav-studio').click();
  await page.evaluate(async () => {
    window.finishPermissionQuery();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await expect(page.locator('#studio-view')).toBeVisible();
  await calls(page, 0);
});

async function calls(page, count) {
  await expect.poll(() => page.evaluate(() => window.cameraCalls.length)).toBe(count);
}
async function live(page) {
  await expect(page.locator('#scanner-status')).toHaveText('Buscando QR…');
  await expect.poll(() => page.evaluate(() => window.cameraTracks.at(-1).readyState)).toBe('live');
}
async function background(page) {
  await page.evaluate(() => window.setVisibility('hidden'));
  await expect
    .poll(() =>
      page.evaluate(() => window.cameraTracks.every((track) => track.readyState === 'ended')),
    )
    .toBe(true);
  await page.evaluate(() => window.setVisibility('visible'));
}

test('an unanswered permission query does not prevent an installed app from requesting camera access', async ({
  page,
}) => {
  await camera(page, { installed: true, state: 'prompt', pendingQuery: true });
  await page.goto('/?app=1');
  await expect
    .poll(() => page.evaluate(() => window.cameraCalls.length), { timeout: 2500 })
    .toBe(1);
  await live(page);
});

test('authorized camera starts on entry, resumes in foreground and stays stopped after an explicit stop', async ({
  page,
}) => {
  await camera(page);
  await page.goto('/');
  await expect(page.locator('#qr-preview svg')).toBeVisible();
  await calls(page, 0);
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await live(page);
  await background(page);
  await calls(page, 2);
  await live(page);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.cameraTracks.at(-1).readyState)).toBe('ended');
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await calls(page, 3);
  await live(page);
  await page.locator('#scanner-stop').click();
  await background(page);
  await expect(page.locator('#scanner-status')).toHaveText('Cámara detenida.');
  await calls(page, 3);
  await page.locator('#nav-studio').click();
  await background(page);
  await calls(page, 3);
  await page.locator('#nav-scan').click();
  await calls(page, 4);
  await live(page);
  expect(await page.evaluate(() => window.cameraCalls.every((call) => call.audio === false))).toBe(
    true,
  );
});

test('installed app asks once on first use and opens with the camera on subsequent launches', async ({
  page,
}) => {
  await camera(page, { installed: true, state: 'prompt' });
  await page.goto('/');
  await expect(page.locator('#scanner-view')).toBeVisible();
  await calls(page, 1);
  await live(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('morphiq-camera')).used)).toBe(
    true,
  );
  await page.reload();
  await calls(page, 1);
  await live(page);
});

test('denied permission shows guidance without repeat requests and recovers when permission is granted', async ({
  page,
}) => {
  await camera(page, { state: 'denied' });
  await page.goto('/?app=1');
  await expect(page.locator('#scanner-status')).toContainText('Permite la cámara');
  await calls(page, 0);
  await page.locator('#scanner-permissions').click();
  await expect(page.getByRole('dialog', { name: 'Permisos de cámara' })).toBeVisible();
  await expect(page.locator('#camera-permission-state')).toContainText('bloqueada');
  await page.locator('#camera-guide-platform').selectOption('android');
  await expect(page.locator('#camera-guide-steps')).toContainText('Mientras se usa la app');
  await expect(page.locator('#camera-guide-note')).toContainText('Preguntar siempre');
  await page.locator('#camera-permissions-try').click();
  await calls(page, 1);
  await expect(page.locator('#scanner-start')).toBeEnabled();
  await background(page);
  await page.locator('#nav-studio').click();
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await page.evaluate(() => window.changePermission('granted'));
  await calls(page, 2);
  await live(page);
  await page.evaluate(() => window.changePermission('denied'));
  await expect(page.locator('#scanner-status')).toContainText('Permite la cámara');
  expect(await page.evaluate(() => window.cameraTracks.at(-1).readyState)).toBe('ended');
  await background(page);
  await calls(page, 2);
});

test('unsupported permission queries and blocked storage still allow automatic startup and resume', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await camera(page, { unsupported: true, storageBlocked: true });
  await page.goto('/?app=1');
  await calls(page, 1);
  await live(page);
  await background(page);
  await calls(page, 2);
  await live(page);
  await page.locator('#scanner-permissions').click();
  await expect(page.locator('#camera-permission-state')).toContainText('Tu navegador');
  await page.keyboard.press('Escape');
  await live(page);
  await calls(page, 3);
  expect(errors).toEqual([]);
});

test('permission help fits small screens, preserves focus and remembers the automatic-start preference', async ({
  page,
}, info) => {
  await camera(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?app=1');
  await live(page);
  await page.locator('#scanner-permissions').click();
  await expect(page.locator('#camera-permissions')).toBeVisible();
  expect(await page.evaluate(() => window.cameraTracks.at(-1).readyState)).toBe('ended');
  await page.locator('#camera-guide-platform').selectOption('ios');
  await expect(page.locator('#camera-guide-steps')).toContainText('Safari');
  const dialog = await page.locator('#camera-permissions').boundingBox();
  expect(dialog.x).toBeGreaterThanOrEqual(0);
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(320);
  expect(dialog.y + dialog.height).toBeLessThanOrEqual(568);
  expect(
    await page
      .locator('#camera-permissions')
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('camera-permission-mobile.png') });
  await page.locator('#camera-auto-start').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#scanner-permissions')).toBeFocused();
  await expect(page.locator('#scanner-status')).toContainText('Inicio automático desactivado');
  await background(page);
  await calls(page, 1);
  await page.reload();
  await expect(page.locator('#scanner-start')).toBeVisible();
  await calls(page, 0);
  await page.locator('#scanner-start').click();
  await calls(page, 1);
  await live(page);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 667, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    const buttons = await page.locator('.camera-controls').boundingBox();
    const status = await page.locator('#scanner-status').boundingBox();
    expect(buttons.y + buttons.height).toBeLessThanOrEqual(status.y);
    expect(status.y + status.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test('a pending camera request can be cancelled and late streams are released', async ({
  page,
}) => {
  await camera(page, { pending: true });
  await page.goto('/?app=1');
  await calls(page, 1);
  await expect(page.locator('#scanner-stop')).toHaveText('Cancelar');
  await page.locator('#scanner-stop').click();
  await expect(page.locator('#scanner-status')).toHaveText('Cámara detenida.');
  await page.evaluate(() => window.finishCamera());
  await expect.poll(() => page.evaluate(() => window.cameraTracks[0].readyState)).toBe('ended');
  await background(page);
  await calls(page, 1);
  await expect(page.locator('#scanner-start')).toBeEnabled();
});

test('camera switching releases the old track and failed torch settings do not change its state', async ({
  page,
}) => {
  await camera(page);
  await page.goto('/?app=1');
  await live(page);
  await page.locator('#scanner-switch').click();
  await calls(page, 2);
  await live(page);
  expect(await page.evaluate(() => window.cameraTracks[0].readyState)).toBe('ended');
  expect(await page.evaluate(() => window.cameraCalls[1].video.facingMode.ideal)).toBe('user');
  await page.evaluate(() => {
    window.rejectTorch = true;
  });
  await page.locator('#scanner-torch').click();
  await expect(page.locator('#scanner-status')).toContainText('linterna');
  await expect(page.locator('#scanner-torch')).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => {
    window.rejectTorch = false;
  });
  await page.locator('#scanner-torch').click();
  await expect(page.locator('#scanner-torch')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.cameraTracks.at(-1).dispatchEvent(new Event('ended')));
  await expect(page.locator('#scanner-status')).toContainText('se desconectó');
  await expect(page.locator('#scanner-torch')).toBeHidden();
  await background(page);
  await calls(page, 2);
});

test('busy cameras remain recoverable without retrying automatically in a loop', async ({
  page,
}) => {
  await camera(page);
  await page.goto('/');
  await page.evaluate(() => {
    window.cameraError = 'NotReadableError';
  });
  await page.locator('#nav-scan').click();
  await calls(page, 1);
  await expect(page.locator('#scanner-status')).toContainText('ocupada');
  await background(page);
  await calls(page, 1);
  await page.evaluate(() => {
    window.cameraError = null;
  });
  await page.locator('#scanner-start').click();
  await calls(page, 2);
  await live(page);
});
