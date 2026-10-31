import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialTheme, applyTheme } from '../src/theme.js';

test('theme respects saved preference, system fallback, and unavailable storage', () => {
  let saved;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  globalThis.document = { documentElement: { dataset: {}, style: {} } };
  try {
    assert.equal(initialTheme(), 'dark');
    applyTheme('light');
    assert.equal(initialTheme(), 'light');
    assert.equal(document.documentElement.dataset.theme, 'light');
    assert.equal(document.documentElement.style.colorScheme, 'light');
    localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    localStorage.setItem = () => { throw new Error('Storage unavailable'); };
    assert.equal(initialTheme(), 'dark');
    assert.doesNotThrow(() => applyTheme('dark'));
    assert.equal(document.documentElement.dataset.theme, 'dark');
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
});
