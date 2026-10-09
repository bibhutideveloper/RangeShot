import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

async function buildExtension() {
  console.log('[RangeShot] Building extension...');
  const distDir = path.resolve('dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle Background Service Worker (ESM)
  await esbuild.build({
    entryPoints: ['src/background/service-worker.ts'],
    bundle: true,
    outfile: 'dist/background.js',
    format: 'esm',
    target: ['chrome110'],
    sourcemap: false,
    minify: false, // Keep readable for inspection/debugging
  });

  // 2. Bundle Content Script (IIFE - required for Chrome content scripts)
  await esbuild.build({
    entryPoints: ['src/content/content-main.ts'],
    bundle: true,
    outfile: 'dist/content.js',
    format: 'iife',
    target: ['chrome110'],
    sourcemap: false,
    minify: false,
  });

  // 3. Bundle Popup Script (IIFE/ESM)
  await esbuild.build({
    entryPoints: ['src/popup/popup.ts'],
    bundle: true,
    outfile: 'dist/popup.js',
    format: 'esm',
    target: ['chrome110'],
    sourcemap: false,
    minify: false,
  });

  // 4. Copy and adapt static assets
  // Popup HTML & CSS
  let popupHtml = fs.readFileSync('src/popup/popup.html', 'utf-8');
  popupHtml = popupHtml.replace('popup.ts', 'popup.js');
  fs.writeFileSync('dist/popup.html', popupHtml, 'utf-8');
  fs.copyFileSync('src/popup/popup.css', 'dist/popup.css');

  // Manifest
  fs.copyFileSync('public/manifest.json', 'dist/manifest.json');

  // Icons
  const iconsDistDir = path.join(distDir, 'icons');
  if (!fs.existsSync(iconsDistDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
  }

  const iconsPublicDir = path.resolve('public/icons');
  if (fs.existsSync(iconsPublicDir)) {
    for (const iconFile of fs.readdirSync(iconsPublicDir)) {
      fs.copyFileSync(
        path.join(iconsPublicDir, iconFile),
        path.join(iconsDistDir, iconFile)
      );
    }
  }

  // Test page
  const testPageDistDir = path.join(distDir, 'test-page');
  if (!fs.existsSync(testPageDistDir)) {
    fs.mkdirSync(testPageDistDir, { recursive: true });
  }
  fs.copyFileSync('test-page/index.html', path.join(testPageDistDir, 'index.html'));
  fs.copyFileSync('test-page/styles.css', path.join(testPageDistDir, 'styles.css'));

  console.log('[RangeShot] Build completed successfully into dist/');
}

buildExtension().catch((err) => {
  console.error('[RangeShot] Build failed:', err);
  process.exit(1);
});
