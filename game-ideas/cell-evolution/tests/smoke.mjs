import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

const cwd = path.resolve(import.meta.dirname, '..');
const SMOKE_TIMEOUT_MS = 45_000;
const ACTION_TIMEOUT_MS = 4_000;
const NAVIGATION_TIMEOUT_MS = 8_000;
const INITIAL_RENDER_TIMEOUT_MS = 10_000;
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '0'], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const logs = [];
let serverUrl = '';
server.stdout.on('data', (data) => logs.push(data.toString()));
server.stderr.on('data', (data) => logs.push(data.toString()));

try {
  await withTimeout(runSmoke(), SMOKE_TIMEOUT_MS, 'Smoke test timed out');
} finally {
  server.kill('SIGTERM');
}

async function runSmoke() {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(serverUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 2, null, { timeout: INITIAL_RENDER_TIMEOUT_MS });
    const firstDish = await dishCenter(page, 0);
    await page.mouse.click(firstDish.x, firstDish.y);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await exerciseDishLifecycle(page);
    await exerciseSaveSlot(page);
    await page.waitForTimeout(250);

    const canvasPixels = await page.evaluate(() => {
      const canvas = document.querySelector('.dish-canvas');
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
  } finally {
    await browser.close();
  }
}

async function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${message} after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    serverUrl = readServerUrl();
    if (serverUrl) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite server did not start:\n${logs.join('\n')}`);
}

function readServerUrl() {
  const text = logs.join('\n');
  const match = text.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/?)/);
  return match?.[1] ?? '';
}

async function dishCenter(page, index) {
  return page.evaluate((dishIndex) => {
    const canvas = document.querySelectorAll('.dish-canvas')[dishIndex];
    if (!canvas) {
      throw new Error(`Missing dish canvas ${dishIndex}`);
    }
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, index);
}

async function exerciseDishLifecycle(page) {
  await clickBySelector(page, '[data-dish-action="delete"]');
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 1);
  await clickBySelector(page, '[data-dish-action="add"]');
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 2);
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas.is-selected').length === 1);
}

async function exerciseSaveSlot(page) {
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas.is-selected').length === 1);
  await clickBySelector(page, '[data-dish-action="save"]');
  await page.locator('#save-modal-title', { hasText: 'Save game' }).waitFor();
  await page.evaluate(() => {
    const row = document.querySelector('.save-slot-row');
    const input = row?.querySelector('input');
    const button = row?.querySelector('button');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Missing first save slot input');
    }
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Missing first save slot button');
    }
    input.value = 'Smoke slot';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    button.click();
  });
  await page.waitForFunction(() => {
    const slots = JSON.parse(localStorage.getItem('cell-evolution-save-slots-v1') ?? '[]');
    return slots[0]?.name === 'Smoke slot' && slots[0]?.data?.dishes?.length === 2;
  });
  await clickBySelector(page, '#save-modal-close');
}

async function clickBySelector(page, selector) {
  await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing clickable element: ${targetSelector}`);
    }
    element.click();
  }, selector);
}
