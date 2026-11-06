// Actual Toolkit/renderer with controlled PDF.js task, loading and cleanup boundaries.
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const { createHash } = require('node:crypto'); const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const rendererPath = process.argv[2] || path.join(root, 'lib/pdf-renderer.ts');
const pagePath = process.argv[3] || path.join(root, 'app/toolkit/page.tsx');
const basePath = path.join(__dirname, 'toolkit-lifecycle.cjs'); const base = fs.readFileSync(basePath, 'utf8');
const end = base.indexOf('\nconst rows=[];'); if (end < 0) throw Error('Frozen hook host changed');
const { host } = vm.runInThisContext('(function(require,__dirname,process){' + base.slice(0, end) + '\nreturn {host};})')(require, __dirname, { argv: ['node', 'host', pagePath] });
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = ts.transpileModule(fs.readFileSync(rendererPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
async function fixture({ holdLoad = false, holdPage = false, holdDestroy = false, failRender = false, failDestroy = false } = {}) {
  const loading = defer(), pages = [], renders = [], cleanup = defer();
  const state = { loads: 0, started: 0, active: 0, cancelled: 0, destroyStarted: 0, destroyed: 0, cleanedPages: 0, canvases: [] };
  if (!holdDestroy) cleanup.resolve();
  const destroy = async () => { state.destroyStarted++; await cleanup.promise; if (failDestroy) throw Error('controlled cleanup failure'); state.destroyed++; };
  const doc = { numPages: 8, destroy, getPage: async () => {
    if (holdPage) { const p = defer(); pages.push(p); await p.promise; }
    return { cleanup: () => state.cleanedPages++, getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }), render: () => {
      state.started++; state.active++; const d = defer(); let settled = false;
      const settle = error => { if (settled) return; settled = true; state.active--; if (error) d.reject(error); else d.resolve(); };
      renders.push(() => settle(failRender ? Error('controlled render error') : null));
      return { promise: d.promise, cancel: () => { state.cancelled++; const error = Error('cancelled render'); error.name = 'RenderingCancelledException'; settle(error); } };
    } };
  } };
  if (!holdLoad) loading.resolve(doc);
  const context = vm.createContext({ URL, DOMException, AbortController, document: { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,test' }; state.canvases.push(canvas); return canvas;
  } } });
  const dependency = new vm.SyntheticModule(['GlobalWorkerOptions', 'getDocument'], function () {
    this.setExport('GlobalWorkerOptions', {}); this.setExport('getDocument', () => { state.loads++; return { promise: loading.promise, destroy }; });
  }, { context });
  const module = new vm.SourceTextModule(output, { context, initializeImportMeta: meta => { meta.url = 'https://pdf-toolkit.test/renderer.mjs'; } });
  await module.link(name => { if (name !== 'pdfjs-dist') throw Error('Unexpected dependency'); return dependency; }); await module.evaluate();
  return { api: module.namespace, state, cleanup, release: () => { loading.resolve(doc); pages.splice(0).forEach(p => p.resolve()); renders.splice(0).forEach(fn => fn()); } };
}
async function drain(jobs) { for (let i = 0; i < 14; i++) { jobs.forEach(j => { j.cleanup.resolve(); j.release(); }); await tick(); } }
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
(async () => {
  const tests = [], details = [];
  const test = async (id, fn) => { try { const actual = await fn(); tests.push({ id, actual, expected: true, pass: actual === true }); } catch (error) { tests.push({ id, actual: error.message, expected: true, pass: false }); } };
  for (const phase of ['pre-aborted', 'loading', 'get-page', 'render']) await test('renderer-abort-' + phase, async () => {
    const job = await fixture({ holdLoad: phase === 'loading', holdPage: phase === 'get-page' }); const abort = new AbortController();
    if (phase === 'pre-aborted') abort.abort();
    let error; const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4, abort.signal).catch(e => { error = e; });
    await tick(); abort.abort(); await tick();
    const promptlyStopped = phase === 'pre-aborted' ? job.state.loads === 0 : job.state.destroyStarted === 1 && job.state.active === 0;
    await drain([job]); await done;
    details.push({ phase, ...job.state, canvases: job.state.canvases.length });
    return promptlyStopped && error?.name === 'AbortError' && job.state.started <= (phase === 'render' ? 4 : 0) && job.state.canvases.every(c => c.width === 0 && c.height === 0) && job.state.destroyed === (phase === 'pre-aborted' ? 0 : 1);
  });
  await test('renderer-abort-awaits-destroy-once', async () => {
    const job = await fixture({ holdDestroy: true }); const abort = new AbortController(); let settled = false;
    const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4, abort.signal).catch(() => {}).finally(() => { settled = true; });
    await tick(); abort.abort(); abort.abort(); await tick(); const waits = !settled && job.state.destroyStarted === 1 && job.state.active === 0;
    await drain([job]); await done; return waits && job.state.destroyed === 1 && job.state.cancelled === 4;
  });
  for (const failRender of [false, true]) await test(failRender ? 'renderer-normal-failure-cleans-up' : 'renderer-no-signal-still-completes', async () => {
    const job = await fixture({ failRender }); let failed = false; let result;
    const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4).then(r => { result = r; }, () => { failed = true; });
    await drain([job]); await done; return failed === failRender && (failRender || result.length === 8) && job.state.destroyed === 1 && job.state.active === 0 && job.state.canvases.every(c => c.width === 0 && c.height === 0);
  });
  await test('renderer-abort-after-completion-does-not-redestroy', async () => {
    const job = await fixture(); const abort = new AbortController(); const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4, abort.signal);
    await drain([job]); await done; abort.abort(); await tick(); return job.state.destroyStarted === 1 && job.state.cancelled === 0;
  });
  await test('renderer-abort-during-final-cleanup-is-awaited', async () => {
    const job = await fixture({ holdDestroy: true }); const abort = new AbortController(); let error, settled = false;
    const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4, abort.signal).catch(e => { error = e; }).finally(() => { settled = true; });
    for (let i = 0; i < 8; i++) { job.release(); await tick(); }
    const waits = job.state.destroyStarted === 1 && !settled; abort.abort(); job.cleanup.resolve(); await done;
    return waits && error?.name === 'AbortError' && job.state.destroyed === 1;
  });
  await test('renderer-cleanup-failure-is-not-hidden-as-cancellation', async () => {
    const job = await fixture({ failDestroy: true }); const abort = new AbortController(); let error;
    const done = job.api.renderAllPages(new Uint8Array([1]), 160, 4, abort.signal).catch(e => { error = e; });
    await tick(); abort.abort(); await drain([job]); await done;
    return error?.message === 'controlled cleanup failure' && job.state.destroyStarted === 1 && job.state.active === 0;
  });
  for (const action of ['reset', 'unmount', 'selection-start', 'replacement', 'rapid-replacement']) await test('toolkit-cancels-' + action, async () => {
    const jobs = [], received = []; const pending = [];
    const page = host({ render: async (bytes, maxPx, concurrency, signal) => { const job = await fixture({ holdDestroy: jobs.length === 0 }); jobs.push(job); received.push(bytes[0]); return job.api.renderAllPages(bytes, maxPx, concurrency, signal); } });
    pending.push(page.load([{ name: 'A.pdf', bytes: new Uint8Array([1]) }])); await tick();
    if (action === 'selection-start') nodes(page.renderTree()).find(n => n.props?.onFiles).props.onSelectionStart();
    else if (action.includes('replacement')) {
      pending.push(page.load([{ name: 'B.pdf', bytes: new Uint8Array([2]) }]));
      if (action === 'rapid-replacement') pending.push(page.load([{ name: 'C.pdf', bytes: new Uint8Array([3]) }]));
    } else page[action]();
    await tick(); const stopped = jobs[0].state.active === 0 && jobs[0].state.cancelled === 4 && jobs[0].state.destroyStarted === 1;
    const barrier = jobs.length === 1; jobs[0].cleanup.resolve(); await tick(); await drain(jobs); await Promise.all(pending);
    details.push({ action, stopped, barrier, received, obsoletePagesStarted: jobs[0].state.started, destroyed: jobs.map(j => j.state.destroyed) });
    return stopped && barrier && jobs[0].state.started === 4 && jobs.every(j => j.state.destroyed === 1) && page.state[5] === null && (action.includes('replacement') ? received.join() === (action === 'replacement' ? '1,2' : '1,3') : page.state[1].length <= 1);
  });
  await test('toolkit-current-render-failure-remains-visible', async () => {
    const job = await fixture({ failRender: true }); const page = host({ render: (...args) => job.api.renderAllPages(...args) });
    const done = page.load([{ name: 'bad-render.pdf', bytes: new Uint8Array([1]) }]); await drain([job]); await done;
    return page.state[5] === 'Failed to load PDFs.' && job.state.destroyed === 1;
  });
  console.log(JSON.stringify({ node: process.version, sources: { page: sha(pagePath), renderer: sha(rendererPath) }, harness_sha256: sha(__filename), base_harness_sha256: sha(basePath), tests, details }));
  process.exitCode = tests.every(t => t.pass) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
