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
    await exerciseHoverWithoutSelection(page);
    const firstDish = await dishCenter(page, 0);
    await page.mouse.click(firstDish.x, firstDish.y);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await exerciseDishLifecycle(page);
    await exerciseSaveSlot(page);
    await exerciseDishPicker(page);
    await exerciseTutorial(page);
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

async function exerciseHoverWithoutSelection(page) {
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas.is-selected').length === 0);
  const firstDish = await dishCenter(page, 0);
  await page.mouse.move(firstDish.x, firstDish.y);
  await page.waitForFunction(() => {
    const title = document.querySelector('#hover-name')?.textContent ?? '';
    return title.startsWith('Dish ');
  });
}

async function exerciseDishLifecycle(page) {
  await clickBySelector(page, '[data-dish-action="delete"]');
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 1);
  await clickBySelector(page, '[data-dish-action="add"]');
  await page.locator('#new-dish-modal-title', { hasText: 'New dish' }).waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('#new-dish-cell-count-input');
    const range = document.querySelector('#new-dish-cell-count-range');
    const resources = [...document.querySelectorAll('[data-new-dish-resource]')];
    const environment = [...document.querySelectorAll('[data-new-dish-environment]')];
    return input instanceof HTMLInputElement
      && range instanceof HTMLInputElement
      && input.value === '10'
      && range.value === '10'
      && resources.length === 4
      && resources.every((slider) => slider instanceof HTMLInputElement && slider.value === '20')
      && environment.length === 2
      && environment.every((slider) => slider instanceof HTMLInputElement && slider.value === '0');
  });
  await page.fill('#new-dish-cell-count-input', '12');
  await page.evaluate(() => {
    for (const slider of document.querySelectorAll('[data-new-dish-resource]')) {
      slider.value = '0';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const poison = document.querySelector('[data-new-dish-environment="poison"]');
    const rock = document.querySelector('[data-new-dish-environment="rock"]');
    poison.value = '2';
    poison.dispatchEvent(new Event('input', { bubbles: true }));
    rock.value = '1';
    rock.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickBySelector(page, '#new-dish-create');
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 2);
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas.is-selected').length === 1);
  await page.waitForFunction(() => document.querySelector('#population-readout')?.textContent === '12 cells');
  await page.waitForFunction(() => {
    const text = document.querySelector('#dish-detail')?.textContent ?? '';
    return text.includes('Poison2') && text.includes('Blocks1');
  });
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

async function exerciseDishPicker(page) {
  await page.evaluate(() => {
    const layer = document.querySelector('#dish-layer');
    layer?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('[data-dish-action="tutorial"]')?.hidden === false);
  await page.waitForFunction(() => document.querySelectorAll('[data-rename-dish]').length >= 1);
  const firstRename = page.locator('[data-rename-dish]').first();
  await firstRename.fill('Training Dish');
  await firstRename.press('Enter');
  await page.evaluate(() => {
    const icon = document.querySelector('[data-select-dish]');
    if (!(icon instanceof HTMLButtonElement)) {
      throw new Error('Missing dish select icon');
    }
    icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#dish-window-title')?.textContent === 'Training Dish | State');
  await page.waitForFunction(() => document.querySelector('[data-dish-action="tutorial"]')?.hidden === true);
}

async function exerciseTutorial(page) {
  await page.evaluate(() => {
    const layer = document.querySelector('#dish-layer');
    layer?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await clickBySelector(page, '[data-dish-action="tutorial"]');
  await page.locator('#tutorial-title', { hasText: 'Tutorial | 1/7' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.dish-canvas').length === 1);
  await page.waitForFunction(() => document.querySelector('#population-readout')?.textContent === '1 cells');
  const beforeNextRect = await page.evaluate(() => {
    const canvas = document.querySelector('.dish-canvas');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  await page.evaluate(() => {
    const control = document.querySelector('[data-control="oxygenMetabolism"]');
    if (!(control instanceof HTMLInputElement)) {
      throw new Error('Missing ATP production tutorial control');
    }
    control.value = '90';
    control.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#tutorial-goal')?.getAttribute('data-state') === 'complete', null, { timeout: 10_000 });
  await clickBySelector(page, '#tutorial-next');
  await page.locator('#tutorial-title', { hasText: 'Tutorial | 2/7' }).waitFor();
  await page.waitForFunction(() => (document.querySelector('#dish-detail')?.textContent ?? '').includes('Glucose1'));
  const afterNextRect = await page.evaluate(() => {
    const canvas = document.querySelector('.dish-canvas');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  for (const key of ['left', 'top', 'width', 'height']) {
    if (Math.abs(beforeNextRect[key] - afterNextRect[key]) > 0.5) {
      throw new Error(`Tutorial next moved dish ${key}: ${beforeNextRect[key]} -> ${afterNextRect[key]}`);
    }
  }
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
