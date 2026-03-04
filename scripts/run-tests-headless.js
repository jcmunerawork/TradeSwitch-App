/**
 * Ejecuta los tests con un navegador headless (Chromium).
 * Si CHROME_BIN no está definido, busca en este orden: Chrome, Brave, Edge.
 * Cualquier navegador Chromium (Chrome, Brave, Edge) sirve para Karma.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

// Orden de búsqueda: Chrome → Brave → Edge (todos son Chromium)
const browserPaths = [
  path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
];

if (isWindows && !process.env.CHROME_BIN) {
  const found = browserPaths.find((p) => fs.existsSync(p));
  if (found) {
    process.env.CHROME_BIN = found;
    const name = found.includes('Brave') ? 'Brave' : found.includes('Edge') ? 'Edge' : 'Chrome';
    console.log('Using', name, 'for headless tests:', found);
  }
}

const child = spawn('npx', ['ng', 'test', '--no-watch', '--browsers=ChromeHeadless'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
