import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'dist/index.html',
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'dist/pwa-192x192.png',
  'dist/pwa-512x512.png',
  'dist/maskable-icon-512x512.png',
  'dist/apple-touch-icon-180x180.png',
  'dist/favicon.ico',
];

await Promise.all(requiredFiles.map((path) => access(path)));

const sourceIcon = await readFile('public/icon.svg', 'utf8');
assert.match(sourceIcon, /<rect\s+width="512"\s+height="512"\s+fill="#87CEEB"\s*\/>/, 'source icon must use an opaque full-square sky-blue background');
assert.doesNotMatch(sourceIcon, /<rect[^>]*\s(rx|ry)=/, 'source icon background must not have rounded corners');
assert.doesNotMatch(sourceIcon, /fill="url\(#sky\)"/, 'source icon background must not use a non-uniform sky gradient');

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.name, 'Unbaloon');
assert.equal(manifest.short_name, 'Unbaloon');
assert.equal(manifest.start_url, '/unbaloon/');
assert.equal(manifest.scope, '/unbaloon/');
assert.equal(manifest.display, 'standalone');
assert.deepEqual(manifest.display_override, ['fullscreen', 'standalone']);
assert.equal(manifest.orientation, 'any');
assert.equal(manifest.theme_color, '#87CEEB');
assert.equal(manifest.background_color, '#87CEEB');

for (const icon of [
  ['pwa-192x192.png', '192x192', 'any'],
  ['pwa-512x512.png', '512x512', 'any'],
  ['maskable-icon-512x512.png', '512x512', 'maskable'],
]) {
  assert.ok(manifest.icons.some((entry) => (
    entry.src === icon[0]
    && entry.sizes === icon[1]
    && entry.purpose === icon[2]
  )), `missing manifest icon ${icon[0]}`);
}

function pngDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const [path, size] of [
  ['dist/pwa-192x192.png', 192],
  ['dist/pwa-512x512.png', 512],
  ['dist/maskable-icon-512x512.png', 512],
  ['dist/apple-touch-icon-180x180.png', 180],
]) {
  assert.deepEqual(pngDimensions(await readFile(path)), [size, size]);
}

const html = await readFile('dist/index.html', 'utf8');
assert.match(html, /\/unbaloon\/manifest\.webmanifest/);
const hashedJsBundle = html.match(/\/unbaloon\/(assets\/index-[^"']+\.js)/)?.[1];
assert.ok(hashedJsBundle, 'index.html must reference a hashed JS bundle');

const serviceWorker = await readFile('dist/sw.js', 'utf8');
const workboxRuntimeImport = serviceWorker.match(/define\(\[\s*["'](\.\/workbox-[^"']+)["']\s*\]/)?.[1]
  ?? serviceWorker.match(/importScripts\(\s*["'](\.\/workbox-[^"']+\.js)["']\s*\)/)?.[1];
assert.ok(workboxRuntimeImport, 'service worker must import a Workbox runtime support file');
const workboxRuntimePath = workboxRuntimeImport.endsWith('.js')
  ? `dist/${workboxRuntimeImport.slice(2)}`
  : `dist/${workboxRuntimeImport.slice(2)}.js`;
await access(workboxRuntimePath);
assert.match(serviceWorker, /NavigationRoute\(.*createHandlerBoundToURL\("index\.html"\)/, 'service worker must provide an index.html navigation fallback');
for (const asset of [
  'index.html',
  hashedJsBundle,
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
]) {
  assert.ok(serviceWorker.includes(asset), `service worker does not precache ${asset}`);
}

console.log('PWA build verified');
