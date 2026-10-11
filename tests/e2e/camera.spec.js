import { test, expect } from '@playwright/test';

async function camera(page, options = {}) {
  await page.addInitScript((settings) => {
    window.cameraCalls = [];
    window.cameraTracks = [];
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
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.cameraCalls.push(constraints);
      if (window.permissionState === 'denied') throw new DOMException('Denied', 'NotAllowedError');
      if (settings.pending)
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
