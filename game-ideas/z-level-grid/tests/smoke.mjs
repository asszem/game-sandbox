import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from '../node_modules/playwright/index.js';

const { chromium } = playwright;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const relativePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.contextMenuEvents = [];
    document.addEventListener('contextmenu', (event) => {
      window.contextMenuEvents.push({ defaultPrevented: event.defaultPrevented });
    });
  });
  await page.waitForTimeout(250);

  const initialState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (initialState.trail.visitedCells !== 1) {
    throw new Error(`Unexpected initial trail count ${initialState.trail.visitedCells}`);
  }
  if (initialState.trail.shape !== 'cube') {
    throw new Error(`Expected cube trail shape, got ${initialState.trail.shape}`);
  }
  if (initialState.grid.cellSize !== initialState.grid.layerGap) {
    throw new Error('Z level distance does not match grid cell size');
  }
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) {
    throw new Error('Canvas did not render');
  }
  const hud = await page.locator('.hud').boundingBox();
  if (!hud || hud.x + hud.width >= canvas.x) {
    throw new Error(`HUD overlaps or is not left of canvas: ${JSON.stringify({ hud, canvas })}`);
  }
  await page.keyboard.down('AltLeft');
  const sideLabelsShown = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!sideLabelsShown.sideLabels.visible || sideLabelsShown.sideLabels.visibleCount !== 6) {
    throw new Error(`Left Alt did not show all side labels: ${JSON.stringify(sideLabelsShown.sideLabels)}`);
  }
  const initialLabelSize = sideLabelsShown.sideLabels.size;
  await page.keyboard.up('AltLeft');
  const sideLabelsHidden = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (sideLabelsHidden.sideLabels.visible) {
    throw new Error('Side labels stayed visible after Left Alt was released');
  }
  await page.keyboard.press('Digit3');
  const afterFace3 = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterFace3.rotation.visibleSide !== 3 || Math.abs(afterFace3.rotation.y + Math.PI / 2) > 0.001) {
    throw new Error(`Digit3 did not face side 3: ${JSON.stringify(afterFace3.rotation)}`);
  }
  if (!afterFace3.sideLabels.visible || afterFace3.sideLabels.visibleCount !== 1) {
    throw new Error(`Digit3 did not show one side label: ${JSON.stringify(afterFace3.sideLabels)}`);
  }
  await page.keyboard.press('Digit1');
  const afterFace1 = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterFace1.rotation.visibleSide !== 1 || afterFace1.rotation.x !== 0 || afterFace1.rotation.y !== 0) {
    throw new Error(`Digit1 did not restore side 1: ${JSON.stringify(afterFace1.rotation)}`);
  }
  if (!afterFace1.sideLabels.visible || afterFace1.sideLabels.visibleCount !== 1) {
    throw new Error(`Digit1 did not show one side label: ${JSON.stringify(afterFace1.sideLabels)}`);
  }
  await page.waitForTimeout(2400);
  const afterSideLabelTimeout = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterSideLabelTimeout.sideLabels.visible) {
    throw new Error('Temporary side label stayed visible after timeout');
  }
  if (Math.abs(afterFace1.cameraTarget.z - 49.5) > 0.001) {
    throw new Error(`Digit1 did not center the whole cube: ${JSON.stringify(afterFace1.cameraTarget)}`);
  }

  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.62, canvas.y + canvas.height * 0.4, { steps: 6 });
  await page.mouse.up();
  const afterLeftDrag = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterLeftDrag.cameraTarget.x === initialState.cameraTarget.x &&
    afterLeftDrag.cameraTarget.y === initialState.cameraTarget.y
  ) {
    throw new Error('Left drag did not pan the camera target');
  }
  if (afterLeftDrag.rotation.x !== initialState.rotation.x || afterLeftDrag.rotation.z !== initialState.rotation.z) {
    throw new Error('Left drag should pan, not rotate');
  }

  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.25);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvas.x + canvas.width * 0.68, canvas.y + canvas.height * 0.55, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.click(canvas.x + canvas.width * 0.52, canvas.y + canvas.height * 0.34, { button: 'right' });
  const contextMenuEvents = await page.evaluate(() => window.contextMenuEvents);
  if (!contextMenuEvents.length || contextMenuEvents.some((event) => !event.defaultPrevented)) {
    throw new Error(`Right-click context menu was not prevented: ${JSON.stringify(contextMenuEvents)}`);
  }
  const afterRightDrag = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterRightDrag.rotation.x === afterLeftDrag.rotation.x ||
    afterRightDrag.rotation.y === afterLeftDrag.rotation.y
  ) {
    throw new Error('Right drag did not change x/y rotation');
  }
  if (
    Math.abs(afterRightDrag.selectedScreen.x - afterLeftDrag.selectedScreen.x) > 0.0001 ||
    Math.abs(afterRightDrag.selectedScreen.y - afterLeftDrag.selectedScreen.y) > 0.0001
  ) {
    throw new Error('Rotation did not pivot around the selected cell');
  }

  const rotationText = await page.locator('#rotation-readout').textContent();
  const displayedY = (Math.round(afterRightDrag.rotation.y * 100) / 100).toFixed(2);
  if (!rotationText?.includes(`y ${displayedY}`)) {
    throw new Error(`Rotation HUD did not update: ${rotationText}`);
  }
  await page.keyboard.press('KeyW');
  const afterRotatedMove = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterRotatedMove.cameraTarget.x !== afterRightDrag.cameraTarget.x ||
    afterRotatedMove.cameraTarget.y !== afterRightDrag.cameraTarget.y ||
    afterRotatedMove.cameraTarget.z !== afterRightDrag.cameraTarget.z
  ) {
    throw new Error('WASD movement changed the viewport after rotation');
  }
  if (
    afterRotatedMove.selectedScreen.x === afterRightDrag.selectedScreen.x &&
    afterRotatedMove.selectedScreen.y === afterRightDrag.selectedScreen.y
  ) {
    throw new Error('WASD movement did not move the selected cell after rotation');
  }

  await page.mouse.move(canvas.x + canvas.width * 0.45, canvas.y + canvas.height * 0.45);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(canvas.x + canvas.width * 0.45, canvas.y + canvas.height * 0.62, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  const afterMiddleDrag = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterMiddleDrag.rotation.y === afterRightDrag.rotation.y) {
    throw new Error('Middle drag did not change y rotation');
  }

  await page.keyboard.press('Shift+KeyW');
  await page.keyboard.press('Shift+KeyD');
  const afterShiftRotate = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterShiftRotate.rotation.x === afterRightDrag.rotation.x ||
    afterShiftRotate.rotation.z === afterRightDrag.rotation.z
  ) {
    throw new Error('Shift+WASD did not rotate x/z');
  }

  await page.keyboard.press('KeyQ');
  const afterQ = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.press('KeyE');
  const afterE = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterQ.rotation.y === afterShiftRotate.rotation.y || afterE.rotation.y === afterQ.rotation.y) {
    throw new Error('Q/E did not rotate y');
  }

  await page.keyboard.press('KeyC');
  const afterCenter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterCenter.rotation.x !== afterE.rotation.x ||
    afterCenter.rotation.y !== afterE.rotation.y ||
    afterCenter.rotation.z !== afterE.rotation.z ||
    afterCenter.lastInput !== 'center'
  ) {
    throw new Error(`C changed rotation or wrong input: ${JSON.stringify(afterCenter)}`);
  }
  if (
    Math.abs(afterCenter.selectedScreen.x) > 0.001 ||
    Math.abs(afterCenter.selectedScreen.y) > 0.001
  ) {
    throw new Error(`C did not center selected cell in viewport: ${JSON.stringify(afterCenter.selectedScreen)}`);
  }

  await page.keyboard.press('Shift+KeyC');
  const afterResetCenter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (
    afterResetCenter.rotation.x !== 0 ||
    afterResetCenter.rotation.y !== 0 ||
    afterResetCenter.rotation.z !== 0 ||
    afterResetCenter.lastInput !== 'center reset'
  ) {
    throw new Error(`Shift+C did not reset to top view: ${JSON.stringify(afterResetCenter.rotation)}`);
  }
  if (
    Math.abs(afterResetCenter.cameraTarget.x) > 0.001 ||
    Math.abs(afterResetCenter.cameraTarget.y) > 0.001 ||
    Math.abs(afterResetCenter.cameraTarget.z - afterResetCenter.selected.z) > 0.001
  ) {
    throw new Error('Shift+C did not center camera target on selected grid');
  }

  await page.mouse.wheel(0, -500);
  const afterZoomIn = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterZoomIn.zoom.cameraDistance !== afterMiddleDrag.zoom.cameraDistance - 1) {
    throw new Error('Mouse wheel did not zoom in by 1');
  }
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 500);
  await page.keyboard.up('Shift');
  const afterZoomOut = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterZoomOut.zoom.cameraDistance !== afterZoomIn.zoom.cameraDistance + 10) {
    throw new Error('Shift+mouse wheel did not zoom out by 10');
  }
  const zoomText = await page.locator('#zoom-readout').textContent();
  if (!zoomText?.includes(afterZoomOut.zoom.cameraDistance.toFixed(1))) {
    throw new Error(`Zoom HUD did not update: ${zoomText}`);
  }
  for (let index = 0; index < 24; index += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(100);
  }
  const afterAcceleratedZoom = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterZoomOut.zoom.cameraDistance - afterAcceleratedZoom.zoom.cameraDistance <= 24) {
    throw new Error('Sustained mouse wheel input did not accelerate zoom');
  }
  await page.keyboard.down('AltLeft');
  const afterZoomLabels = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.up('AltLeft');
  if (afterZoomLabels.sideLabels.size !== initialLabelSize) {
    throw new Error('Side label size changed with zoom level');
  }

  for (const [key, axis, direction] of [
    ['KeyW', 'y', 1],
    ['KeyS', 'y', -1],
    ['KeyA', 'x', -1],
    ['KeyD', 'x', 1],
  ]) {
    const before = await getSelectedScreenPosition(page);
    await page.keyboard.press(key);
    const after = await getSelectedScreenPosition(page);
    const delta = after[axis] - before[axis];
    if (Math.sign(delta) !== direction) {
      throw new Error(`${key} moved ${axis} by ${delta}, expected direction ${direction}`);
    }
  }

  await page.keyboard.press('KeyF');
  const afterDescend = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (afterDescend.selected.z !== 98) {
    throw new Error(`Expected free descent to z 98: ${JSON.stringify(afterDescend.selected)}`);
  }
  await page.keyboard.press('KeyR');

  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  if (state.grid.columns !== 100 || state.grid.rows !== 100 || state.grid.layers !== 100) {
    throw new Error('Unexpected grid dimensions');
  }
  if (state.renderer !== 'three-webgl') {
    throw new Error(`Unexpected renderer ${state.renderer}`);
  }
  if (state.selected.z !== 99) {
    throw new Error(`Unexpected selected z ${JSON.stringify(state.selected)}`);
  }
  if (state.trail.visitedCells <= initialState.trail.visitedCells) {
    throw new Error(`Trail did not grow: ${state.trail.visitedCells}`);
  }
  if (afterMiddleDrag.rotation.y === initialState.rotation.y) {
    throw new Error('Mouse drag did not rotate the level stack around y');
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function getSelectedScreenPosition(page) {
  return page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.selectedScreen;
  });
}
