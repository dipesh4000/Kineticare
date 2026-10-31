import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('install event is captured early, shared, consumed once, and cleared on installation', async () => {
  const browser = new EventTarget();
  const displayMode = new EventTarget();
  browser.navigator = { standalone: false };
  browser.matchMedia = () => displayMode;
  globalThis.window = browser;
  try {
    const store = await import('../src/components/pwaInstall.js');
    let notifications = 0;
    const unsubscribe = store.subscribeToInstall(() => notifications++);
    for (const outcome of ['dismissed', 'accepted', 'error']) {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      let calls = 0;
      event.prompt = async () => { calls++; if (outcome === 'error') throw new Error('Browser refused'); };
      event.userChoice = Promise.resolve({ outcome });
      browser.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      assert.equal(store.getInstallSnapshot().prompt, event);
      assert.equal(await store.installApp(), outcome === 'accepted');
      assert.equal(await store.installApp(), false);
      assert.equal(calls, 1);
      assert.equal(store.getInstallSnapshot().prompt, null);
      assert.equal(store.getInstallSnapshot().installed, false);
    }
    browser.dispatchEvent(new Event('appinstalled'));
    assert.equal(store.getInstallSnapshot().installed, true);
    assert.equal(store.getInstallSnapshot().prompt, null);
    browser.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    assert.equal(store.getInstallSnapshot().prompt, null);
    assert.equal(notifications, 7);
    unsubscribe();
  } finally { delete globalThis.window; }
});

test('service worker supplies an offline page without intercepting API or caching data', async () => {
  const handlers = {};
  const worker = {
    location: { origin: 'https://kineticare.example' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: worker, URL, Response,
    fetch: async () => { throw new Error('Offline'); },
  });
  for (const path of ['/api', '/api/health', '/api/records']) {
    handlers.fetch({
      request: { mode: 'navigate', url: `https://kineticare.example${path}` },
      respondWith: () => assert.fail('API requests must bypass the worker'),
    });
  }
  let response;
  handlers.fetch({
    request: { mode: 'navigate', url: 'https://kineticare.example/patient/home' },
    respondWith: promise => { response = promise; },
  });
  const fallback = await response;
  assert.equal(fallback.status, 503);
  assert.match(fallback.headers.get('Content-Type'), /text\/html/);
  assert.match(await fallback.text(), /You’re offline/);
});

test('manifest includes real Android PNG icons in the required sizes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.type === 'image/png');
    assert.ok(icon);
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
