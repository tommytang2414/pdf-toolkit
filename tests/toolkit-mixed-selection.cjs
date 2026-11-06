// Real Dropzone and PDF parser; frozen lifecycle host supplies controlled React state.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const basePath = path.join(__dirname, 'toolkit-lifecycle.cjs');
const base = fs.readFileSync(basePath, 'utf8');
const boundary = base.indexOf('\nconst rows=[];');
if (boundary < 0) throw Error('Trusted host shape changed');
const { host, defer, pdf } = vm.runInThisContext('(function(require,__dirname,process){' + base.slice(0, boundary) + '\nreturn {host,defer,pdf};})')(require, __dirname, process);
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const notice = h => nodes(h.renderTree()).find(n => n.props?.role === 'status');
const names = h => nodes(notice(h)).filter(n => n.type === 'li').map(n => n.props.children);
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
(async () => {
  const doc = await pdf.PDFDocument.create(); doc.addPage([123, 200]); const bytes = await doc.save();
  const file = (name, type = 'application/pdf', data = bytes) => ({ name, type, size: data.length, arrayBuffer: async () => data.slice().buffer });
  const tests = [];
  const test = async (id, fn) => { const actual = await fn(); tests.push({ id, actual, expected: true, pass: actual === true }); };
  await test('mixed-selection-lists-every-ignored-name-and-delivers-only-pdf', async () => {
    let received = []; const h = host({ drop: true, api: { onFiles: files => { received = files; } } });
    h.drop([file('valid.pdf'), file('notes.txt', 'text/plain'), file('photo.png', 'image/png')]); await settle();
    return JSON.stringify(names(h)) === JSON.stringify(['notes.txt', 'photo.png']) && received.length === 1 && received[0].name === 'valid.pdf' && received[0].pageCount === 1 && h.state[1] === null;
  });
  await test('all-invalid-lists-names-and-retains-rejection', async () => {
    let calls = 0; const h = host({ drop: true, api: { onFiles: () => calls++ } });
    h.drop([file('unknown.pdf', ''), file('notes.txt', 'text/plain')]); await settle();
    return names(h).join('|') === 'unknown.pdf|notes.txt' && h.state[1] === 'Please drop PDF files only.' && calls === 0;
  });
  await test('valid-next-selection-clears-old-notice', async () => {
    const h = host({ drop: true, api: { onFiles() {} } }); h.drop([file('first.pdf'), file('old.txt', 'text/plain')]); await settle();
    h.drop([file('second.pdf')]); await settle(); return !notice(h) && h.state[1] === null;
  });
  await test('parser-failure-retains-ignored-names', async () => {
    let calls = 0; const h = host({ drop: true, api: { onFiles: () => calls++ } });
    h.drop([file('broken.pdf', 'application/pdf', Buffer.from('invalid')), file('ignored.txt', 'text/plain')]); await settle();
    return names(h).join() === 'ignored.txt' && !!h.state[1] && calls === 0;
  });
  await test('stale-selection-cannot-restore-ignored-names', async () => {
    const slow = defer(); const received = []; const h = host({ drop: true, api: { onFiles: files => received.push(files[0].name) } });
    h.drop([{ ...file('old.pdf'), arrayBuffer: () => slow.promise }, file('old.txt', 'text/plain')]);
    h.drop([file('current.pdf')]); await settle(); slow.resolve(bytes.slice().buffer); await settle();
    return !notice(h) && received.join() === 'current.pdf';
  });
  await test('ignored-filenames-are-literal-accessible-text', async () => {
    const name = '<img src=x onerror=alert(1)>.txt'; const h = host({ drop: true, api: { onFiles() {} } });
    h.drop([file('valid.pdf'), file(name, 'text/plain')]); await settle();
    return names(h)[0] === name && notice(h)?.props['aria-live'] === 'polite' && !nodes(notice(h)).some(n => n.props?.dangerouslySetInnerHTML);
  });
  console.log(JSON.stringify({ node: process.version, sources: { dropzone: sha(process.argv[3] || path.join(__dirname, '../components/pdf/PdfDropzone.tsx')) }, harness_sha256: sha(__filename), base_harness_sha256: sha(basePath), tests }));
  process.exitCode = tests.every(t => t.pass) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
