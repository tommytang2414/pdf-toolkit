// Offline behavioral regression: real transpiled renderer, synthetic PDF.js/canvas dependencies.
// Run through DevOps-Scanner's pinned TypeScript runtime; no user document or network access.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.argv[2]);
const source = fs.readFileSync(path.join(__dirname, '../lib/pdf-renderer.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

async function renderer(count = 20, failPage = false, { failLoad = false, nullContext = false } = {}) {
  const state = { started: 0, active: 0, peak: 0, destroyed: 0, pending: [], cleanupFinished: false };
  const loadError = new Error('synthetic invalid PDF');
  const destroy = async () => {
    state.destroyed++;
    await new Promise(resolve => setImmediate(resolve));
    state.cleanupFinished = true;
  };
  const options = {};
  const doc = {
    numPages: count,
    // PDFDocumentProxy.destroy delegates to its loadingTask.destroy in installed PDF.js.
    destroy,
    getPage: async (index) => {
      if (failPage) throw new Error('synthetic page failure');
      state.started++;
      return {
        getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }),
        render: () => {
          state.active++;
          state.peak = Math.max(state.peak, state.active);
          return { promise: new Promise(resolve => state.pending.push(() => {
            state.active--; resolve();
          })) };
        },
      };
    },
  };
  const context = vm.createContext({ URL, document: { createElement: () => ({
    getContext: () => nullContext ? null : ({}), toDataURL: () => 'data:image/jpeg;base64,fixture',
  }) } });
  const dependency = new vm.SyntheticModule(['GlobalWorkerOptions', 'getDocument'], function () {
    this.setExport('GlobalWorkerOptions', options);
    this.setExport('getDocument', () => ({
      promise: failLoad ? Promise.reject(loadError) : Promise.resolve(doc), destroy,
    }));
  }, { context });
  const module = new vm.SourceTextModule(output, { context,
    initializeImportMeta: meta => { meta.url = 'https://pdf-toolkit.test/assets/renderer.mjs'; } });
  await module.link(specifier => {
    assert.equal(specifier, 'pdfjs-dist');
    return dependency;
  });
  await module.evaluate();
  return { api: module.namespace, state, options, loadError };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('PDF worker uses a bundled same-origin URL', async () => {
  const { options } = await renderer();
  assert.equal(new URL(options.workerSrc).origin, 'https://pdf-toolkit.test');
});

for (const concurrency of [1, 4]) {
  test(`only ${concurrency} page renders start before capacity is released`, async () => {
    const { api, state } = await renderer();
    const completion = api.renderAllPages(new Uint8Array(), 200, concurrency);
    await tick();
    // Drain even on assertion failure, keeping failed baseline tests finite.
    const initiallyStarted = state.started;
    while (state.pending.length) {
      state.pending.splice(0).forEach(resolve => resolve());
      await tick();
    }
    const results = await completion;
    assert.equal(initiallyStarted, concurrency);
    assert.ok(state.peak <= concurrency, `peak ${state.peak} exceeded ${concurrency}`);
    assert.deepEqual(Array.from(results, item => item.pageIndex), Array.from({ length: 20 }, (_, i) => i));
    assert.equal(results[0].width, 100);
    assert.equal(results[0].height, 200);
  });
}

test('empty documents finish without scheduling page work', async () => {
  const { api, state } = await renderer(0);
  assert.equal((await api.renderAllPages(new Uint8Array())).length, 0);
  assert.equal(state.started, 0);
});

for (const value of [0, -1, 1.5, NaN, Infinity]) {
  test(`invalid concurrency ${value} is rejected before loading a document`, async () => {
    const { api } = await renderer(0);
    await assert.rejects(api.renderAllPages(new Uint8Array(), 200, value), /positive integer/);
  });
}

test('page count releases the loaded PDF document', async () => {
  const { api, state } = await renderer();
  assert.equal(await api.getPageCount(new Uint8Array()), 20);
  assert.equal(state.destroyed, 1);
});

test('single-page rendering releases the document after completion', async () => {
  const { api, state } = await renderer();
  const completion = api.renderPage(new Uint8Array(), 0);
  await tick();
  state.pending.splice(0).forEach(resolve => resolve());
  await completion;
  assert.equal(state.destroyed, 1);
});

test('batch rendering releases an empty loaded document', async () => {
  const { api, state } = await renderer(0);
  await api.renderAllPages(new Uint8Array());
  assert.equal(state.destroyed, 1);
});

for (const method of ['renderPage', 'renderAllPages']) {
  test(`${method} releases the loaded document when page loading fails`, async () => {
    const { api, state } = await renderer(1, true);
    await assert.rejects(api[method](new Uint8Array(), ...(method === 'renderPage' ? [0] : [])), /synthetic page failure/);
    assert.equal(state.destroyed, 1);
  });
}

for (const method of ['getPageCount', 'renderPage', 'renderAllPages']) {
  test(`${method} awaits loading-task cleanup when PDF loading rejects`, async () => {
    const { api, state, loadError } = await renderer(1, false, { failLoad: true });
    await assert.rejects(
      api[method](new Uint8Array(), ...(method === 'renderPage' ? [0] : [])),
      error => error === loadError,
    );
    assert.equal(state.started, 0, 'failed loading must not schedule page work');
    assert.equal(state.destroyed, 1, 'failed loading task must be destroyed exactly once');
    assert.equal(state.cleanupFinished, true, 'caller must observe completed cleanup');
  });
}

for (const method of ['renderPage', 'renderAllPages']) {
  test(`${method} rejects missing canvas context and releases the document`, async () => {
    const { api, state } = await renderer(1, false, { nullContext: true });
    await assert.rejects(
      api[method](new Uint8Array(), ...(method === 'renderPage' ? [0] : [])),
      /Could not create a 2D rendering context/,
    );
    assert.equal(state.active, 0, 'PDF.js render must not start without a canvas context');
    assert.equal(state.destroyed, 1);
    assert.equal(state.cleanupFinished, true);
  });
}
