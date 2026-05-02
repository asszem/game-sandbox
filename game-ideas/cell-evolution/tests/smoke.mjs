import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const cwd = path.resolve(import.meta.dirname, '..');
const server = spawn('npm', ['run', 'dev', '--', '--port', '4177'], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const logs = [];
server.stdout.on('data', (data) => logs.push(data.toString()));
server.stderr.on('data', (data) => logs.push(data.toString()));

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:4177', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas#dish');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(700, 430, { steps: 5 });
  await page.mouse.up();
  await page.mouse.wheel(0, -250);
  await dragDropItem(page, 'cotton-candy', 720, 390);
  await page.locator('.toast', { hasText: 'Cotton candy dissolved into glucose' }).waitFor();
  await dragDropItem(page, 'cat-pawn', 760, 430);
  await page.locator('.toast', { hasText: 'Cat-pawn dissolved into poison' }).waitFor();
  await page.waitForTimeout(700);

  const canvasPixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return 0;
    }
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return ctx ? canvas.width * canvas.height : 0;
  });

  if (errors.length > 0) {
    throw new Error(`Console errors:\n${errors.join('\n')}`);
  }
  if (canvasPixels <= 0) {
    throw new Error('Canvas did not initialize WebGL');
  }

  await mkdir(path.join(cwd, 'test-output'), { recursive: true });
  await page.screenshot({ path: path.join(cwd, 'test-output', 'smoke.png'), fullPage: true });
  await browser.close();
} finally {
  server.kill('SIGTERM');
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (logs.some((line) => line.includes('Local:'))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite server did not start:\n${logs.join('\n')}`);
}

async function dragDropItem(page, item, clientX, clientY) {
  const button = page.locator(`[data-drop-item="${item}"]`);
  const box = await button.boundingBox();
  if (!box) {
    throw new Error(`Drop item button not visible: ${item}`);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(clientX, clientY, { steps: 8 });
  await page.mouse.up();
}
