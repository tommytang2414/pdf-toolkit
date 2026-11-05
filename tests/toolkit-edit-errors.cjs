// Separate regression for an already-published error becoming stale after an edit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const basePath = path.join(__dirname, 'toolkit-lifecycle.cjs');
const base = fs.readFileSync(basePath, 'utf8');
const boundary = base.indexOf('\nconst rows=[];');
if (boundary < 0) throw Error('Trusted lifecycle host boundary missing');
const { host } = vm.runInThisContext('(function(require,__dirname,process){' + base.slice(0, boundary) + '\nreturn {host};})')(require, __dirname, process);
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
(async () => {
  const tests = [];
  for (const [id, callback, event] of [
    ['rotate-cw-clears-published-error', 'onRotateCW'],
    ['rotate-ccw-clears-published-error', 'onRotateCCW'],
    ['delete-clears-published-error', 'onDelete'],
    ['reorder-clears-published-error', 'onDragEnd', { active: { id: 0 }, over: { id: 1 } }],
  ]) {
    const h = host({ api: { reorderPages: async () => { throw Error('Controlled processing failure'); } },
      seed: [[], [{ pageIndex: 0 }, { pageIndex: 1 }], [0, 1], new Map(), false, null, null, new Uint8Array([1])] });
    await h.download();
    const errorWasVisible = h.state[5] === 'Failed to process PDF.';
    nodes(h.renderTree()).find(n => n.props?.[callback]).props[callback](event);
    const actual = errorWasVisible && h.state[5] === null && h.state[4] === false;
    tests.push({ id, actual, expected: true, pass: actual === true });
  }
  console.log(JSON.stringify({ source_sha256: sha(process.argv[2] || path.join(__dirname, '../app/toolkit/page.tsx')),
    harness_sha256: sha(__filename), base_harness_sha256: sha(basePath), tests }));
  process.exitCode = tests.every(t => t.pass) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
