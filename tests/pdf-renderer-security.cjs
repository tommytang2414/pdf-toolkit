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

async function renderer(count = 20) {
  const state = { started: 0, active: 0, peak: 0, destroyed: 0, pending: [] };
  const options = {};
  const doc = {
    numPages: count,
    destroy: async () => { state.destroyed++; },
    getPage: async (index) => {
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
    getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,fixture',
  }) } });
  const dependency = new vm.SyntheticModule(['GlobalWorkerOptions', 'getDocument'], function () {
    this.setExport('GlobalWorkerOptions', options);
    this.setExport('getDocument', () => ({ promise: Promise.resolve(doc) }));
  }, { context });
  const module = new vm.SourceTextModule(output, { context,
    initializeImportMeta: meta => { meta.url = 'https://pdf-toolkit.test/assets/renderer.mjs'; } });
  await module.link(specifier => {
    assert.equal(specifier, 'pdfjs-dist');
    return dependency;
  });
  await module.evaluate();
  return { api: module.namespace, state, options };
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
