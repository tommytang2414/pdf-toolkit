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

async function renderer(count = 20, failPage = false, { failLoad = false, nullContext = false,
  automatic = false, failRender = false, failEncode = false, encodedLength = 0,
  pageWidth = 100, pageHeight = 200 } = {}) {
  const state = { started: 0, active: 0, peak: 0, destroyed: 0, pending: [], cleanupFinished: false,
    loads: 0, canvases: [], allocated: [], pagesCleaned: 0, activeAtDestroy: 0 };
  const loadError = new Error('synthetic invalid PDF');
  const destroy = async () => {
    state.activeAtDestroy = state.active;
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
        cleanup: () => { state.pagesCleaned++; },
        getViewport: ({ scale }) => ({ width: pageWidth * scale, height: pageHeight * scale }),
        render: () => {
          state.active++;
          state.peak = Math.max(state.peak, state.active);
          if (automatic) return { promise: new Promise((resolve, reject) => setImmediate(() => {
            state.active--;
            if (failRender && index === 1) reject(new Error('synthetic render failure'));
            else resolve();
          })) };
          return { promise: new Promise(resolve => state.pending.push(() => {
            state.active--; resolve();
          })) };
        },
      };
    },
  };
  const context = vm.createContext({ URL, document: { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => {
      state.allocated.push([canvas.width,canvas.height]); return nullContext ? null : ({});
    },
      toDataURL: () => {
        if (failEncode) throw new Error('synthetic encode failure');
        return encodedLength ? 'data:image/jpeg;base64,'.padEnd(encodedLength, 'A') : 'data:image/jpeg;base64,fixture';
      } };
    state.canvases.push(canvas);
    return canvas;
  } } });
  const dependency = new vm.SyntheticModule(['GlobalWorkerOptions', 'getDocument'], function () {
    this.setExport('GlobalWorkerOptions', options);
    this.setExport('getDocument', () => { state.loads++; return ({
      promise: failLoad ? Promise.reject(loadError) : Promise.resolve(doc), destroy,
    }); });
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
    assert.ok(state.canvases.every(c => c.width === 0 && c.height === 0), 'failed canvas backing stores released');
  });
}

// Trusted thumbnail policy: 200 pages, 512 px, 4 concurrent renders, 16 MiB URL characters.
// These are product budgets, not a claim of browser heap isolation or bounded PDF parsing.
test('200-page limit preserves all page indices, dimensions and releases canvases', async () => {
  const { api, state } = await renderer(200, false, { automatic: true });
  const results = await api.renderAllPages(new Uint8Array(), 512, 4);
  assert.deepEqual(Array.from(results, r => r.pageIndex), Array.from({length:200}, (_, i) => i));
  assert.equal(results[199].width, 100); assert.equal(results[199].height, 200);
  assert.ok(state.peak <= 4);
  assert.ok(state.canvases.every(c => c.width === 0 && c.height === 0));
  assert.equal(state.pagesCleaned, 200); assert.equal(state.destroyed, 1);
});

test('201 pages rejects before any page/canvas work and awaits document cleanup', async () => {
  const { api, state } = await renderer(201, false, { automatic: true });
  await assert.rejects(api.renderAllPages(new Uint8Array()), /200|page.*limit|too many pages/i);
  assert.equal(state.started, 0); assert.equal(state.canvases.length, 0);
  assert.equal(state.destroyed, 1); assert.equal(state.cleanupFinished, true);
});

for (const method of ['renderPage','renderAllPages']) {
  for (const maxPx of [0, -1, NaN, Infinity, 513]) {
    test(`${method} rejects invalid thumbnail size ${maxPx} before loading`, async () => {
      const { api, state } = await renderer(1, false, { automatic: true });
      await assert.rejects(api[method](new Uint8Array(), ...(method === 'renderPage' ? [0,maxPx] : [maxPx])), /maxPx|size|dimension|pixel|512/i);
      assert.equal(state.loads, 0); assert.equal(state.canvases.length, 0);
    });
  }
  for (const failure of [null, 'failRender', 'failEncode']) {
    test(`${method} releases page/canvas on ${failure || 'success'} before destroying document`, async () => {
      const { api, state } = await renderer(4, false, { automatic: true, [failure]: true });
      const operation = api[method](new Uint8Array(), ...(method === 'renderPage' ? [0] : []));
      if (failure) await assert.rejects(operation, /synthetic (render|encode) failure/);
      else await operation;
      assert.equal(state.activeAtDestroy, 0, 'all started siblings settle before document destruction');
      assert.ok(state.canvases.every(c => c.width === 0 && c.height === 0), 'canvas backing stores cleared');
      assert.equal(state.pagesCleaned, state.started);
      assert.equal(state.destroyed, 1); assert.equal(state.cleanupFinished, true);
    });
  }
}

test('concurrency above four rejects before loading', async () => {
  const { api, state } = await renderer(1, false, { automatic: true });
  await assert.rejects(api.renderAllPages(new Uint8Array(), 200, 5), /concurrency|four|4/);
  assert.equal(state.loads, 0);
});

for (const over of [false,true]) {
  test(`aggregate thumbnail output ${over ? 'over budget rejects without partial results' : 'at budget succeeds'}`, async () => {
    const limit = 16 * 1024 * 1024;
    const { api, state } = await renderer(2, false, { automatic:true, encodedLength:limit/2+(over?1:0) });
    const operation = api.renderAllPages(new Uint8Array());
    if (over) await assert.rejects(operation, /budget|limit|thumbnail.*size/i);
    else assert.equal((await operation).reduce((n,r) => n+r.dataUrl.length,0),limit);
    assert.ok(state.canvases.every(c => c.width === 0 && c.height === 0));
    assert.equal(state.activeAtDestroy,0); assert.equal(state.destroyed,1);
  });
}

test('large physical pages allocate at most 512 px while preserving aspect ratio', async () => {
  const { api,state } = await renderer(1,false,{automatic:true,pageWidth:2000,pageHeight:4000});
  const results=await api.renderAllPages(new Uint8Array(),512);
  assert.deepEqual(state.allocated,[[256,512]]);
  assert.equal(results[0].width,2000); assert.equal(results[0].height,4000);
  assert.ok(state.canvases.every(c=>c.width===0 && c.height===0));
});

test('repeated successful batches release every canvas and document', async () => {
  const { api,state } = await renderer(4,false,{automatic:true});
  for(let i=0;i<3;i++) {
    assert.equal((await api.renderAllPages(new Uint8Array())).length,4);
    assert.equal(state.destroyed,i+1);
    assert.ok(state.canvases.every(c=>c.width===0 && c.height===0));
  }
});
