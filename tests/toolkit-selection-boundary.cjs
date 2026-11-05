// Execute both real components with a shared callback boundary and deferred work.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const basePath = path.join(__dirname, 'toolkit-lifecycle.cjs');
const base = fs.readFileSync(basePath, 'utf8');
const boundary = base.indexOf('\nconst rows=[];');
const props = 'onFiles:api.onFiles,multiple:true';
if (boundary < 0 || base.split(props).length !== 2) throw Error('Trusted host shape changed');
const source = base.slice(0, boundary).replace(props, 'onFiles:api.onFiles,multiple:api.multiple??true,onSelectionStart:api.onSelectionStart');
const { host, defer, tick } = vm.runInThisContext('(function(require,__dirname,process){' + source + '\nreturn {host,defer,tick};})')(require, __dirname, process);
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const file = (properties = {}) => ({ name: 'B.pdf', type: 'application/pdf', size: 1, arrayBuffer: async () => new Uint8Array([2]).buffer, ...properties });
const clear = h => h.state[0].length === 0 && h.state[1].length === 0 && h.state[2].length === 0 && h.state[4] === false && h.state[5] === null && h.state[6] === null && h.state[7] === null && h.urls.length === 0;
(async () => {
  const tests = [];
  const test = async (id, fn) => { const actual = await fn(); tests.push({ id, actual, expected: true, pass: actual === true }); };
  for (const phase of ['merge', 'render']) for (const rejection of ['type', 'size', 'multiple', 'parse']) {
    await test(`${phase}-cancelled-by-${rejection}-rejection`, async () => {
      const pending = defer();
      const page = host({ api: phase === 'merge' ? { mergePdfs: () => pending.promise } : {}, render: phase === 'render' ? () => pending.promise : async () => [{ pageIndex: 0 }] });
      const old = page.load([{ name: 'A.pdf', bytes: new Uint8Array([1]) }]); await tick();
      const callback = nodes(page.renderTree()).find(n => n.props?.onFiles).props.onSelectionStart;
      const drop = host({ drop: true, api: { onFiles: files => page.load(files), onSelectionStart: callback, multiple: rejection !== 'multiple' },
        parsed: { PDFDocument: { load: async () => { if (rejection === 'parse') throw Error('Controlled parser rejection'); return { getPageCount: () => 1 }; } } } });
      drop.drop(rejection === 'multiple' ? [file(), file()] : [file(rejection === 'type' ? { type: 'text/plain' } : rejection === 'size' ? { size: 101 * 1024 * 1024 } : {})]);
      await tick(); const error = drop.state[1];
      pending.resolve(phase === 'merge' ? new Uint8Array([1]) : [{ pageIndex: 0 }]); await old;
      return !!error && drop.state[1] === error && clear(page);
    });
  }
  await test('new-selection-start-invalidates-pending-download', async () => {
    const pending = defer(); const page = host({ api: { reorderPages: () => pending.promise } }); const old = page.download();
    const start = nodes(page.renderTree()).find(n => n.props?.onFiles).props.onSelectionStart;
    const drop = host({ drop: true, api: { onFiles: files => page.load(files), onSelectionStart: start } });
    drop.drop([file({ type: 'text/plain' })]); pending.resolve(new Uint8Array([1])); await old; return clear(page);
  });
  await test('unmounted-native-file-callback-cannot-start-selection', async () => {
    let starts = 0, deliveries = 0;
    const drop = host({ drop: true, api: { onSelectionStart: () => starts++, onFiles: () => deliveries++ }, parsed: { PDFDocument: { load: async () => ({ getPageCount: () => 1 }) } } });
    const input = { files: [file()], click() {} };
    const previous = global.document;
    try { global.document = { createElement: () => input }; drop.renderTree().props.onClick(); }
    finally { if (previous === undefined) delete global.document; else global.document = previous; }
    drop.unmount(); input.onchange(); await tick(); return starts === 0 && deliveries === 0;
  });
  for (const phase of ['merge', 'render']) await test(`${phase}-failure-visible-without-pages`, async () => {
    const fail = async () => { throw Error('Controlled load failure'); };
    const page = host({ api: phase === 'merge' ? { mergePdfs: fail } : {}, render: phase === 'render' ? fail : async () => [] });
    await page.load([{ name: 'A.pdf', bytes: new Uint8Array([1]) }]);
    return nodes(page.renderTree()).some(n => n.props?.children === 'Failed to load PDFs.') && page.state[4] === false;
  });
  console.log(JSON.stringify({ sources: { page: sha(process.argv[2] || path.join(__dirname, '../app/toolkit/page.tsx')), dropzone: sha(process.argv[3] || path.join(__dirname, '../components/pdf/PdfDropzone.tsx')) }, harness_sha256: sha(__filename), base_harness_sha256: sha(basePath), host_projection_sha256: createHash('sha256').update(source).digest('hex'), tests }));
  process.exitCode = tests.every(t => t.pass) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
