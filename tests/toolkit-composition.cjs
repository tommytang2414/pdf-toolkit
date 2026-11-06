// Execute the real download handler and pdf-lib with synthetic documents only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');
const ts = require('typescript');
const pdf = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.argv[2] || path.join(root, 'app/toolkit/page.tsx'), 'utf8');
const operationsPath = process.argv[3] || path.join(root, 'lib/pdf-operations.ts');
const start = source.indexOf('  const handleDownload = async () => {');
const end = source.indexOf('\n  };', start);
if (start < 0 || end < 0) throw Error('Download handler extraction failed');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
vm.runInThisContext('(function(exports,require){' + compile(fs.readFileSync(operationsPath, 'utf8')) + '\n})')(api, name => {
  if (name !== 'pdf-lib') throw Error('Unexpected import');
  return pdf;
});
const invoke = vm.runInThisContext('(async function(mergedBytes,pages,order,rotations,deletePages,reorderPages,rotatePages){let output=null,error=null;const setLoading=()=>{};const setError=e=>error=e;const createUrl=b=>{output=b;return "synthetic"};const setResultUrl=()=>{};' + compile(source.slice(start, end + 5)) + ';await handleDownload();return {output,error};})');
const profiles = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')) : [
  { id: 'reorder-rotate', widths: [100,200], order: [1,0], rotations: [[0,90]], expected: [[200,0],[100,90]] },
  { id: 'delete-reorder-rotate', widths: [100,200,300], order: [2,0], rotations: [[0,90],[1,270]], expected: [[300,0],[100,90]] },
  { id: 'identity-multiple-rotations', widths: [100,200], order: [0,1], rotations: [[0,90],[1,270]], expected: [[100,90],[200,270]] },
  { id: 'delete-reorder-multiple-rotations', widths: [100,200,300,400], order: [3,1], rotations: [[1,90],[3,270]], expected: [[400,270],[200,90]] },
  { id: 'zero-rotation', widths: [100,200], order: [1,0], rotations: [[0,0]], expected: [[200,0],[100,0]] },
];
(async () => {
  const tests = [];
  for (const t of profiles) {
    let actual;
    try {
      const doc = await pdf.PDFDocument.create();
      t.widths.forEach(width => doc.addPage([width,100]));
      const result = await invoke(await doc.save(), t.widths.map((_,pageIndex) => ({pageIndex})), t.order, new Map(t.rotations), api.deletePages, api.reorderPages, api.rotatePages);
      if (result.error || !result.output) throw Error(result.error || 'Missing output');
      const output = await pdf.PDFDocument.load(result.output);
      actual = output.getPages().map(page => [page.getWidth(),page.getRotation().angle]);
    } catch (error) { actual = { error: error.message }; }
    tests.push({ id: t.id, actual, expected: t.expected, pass: isDeepStrictEqual(actual,t.expected) });
  }
  console.log(JSON.stringify({ node: process.version, typescript: ts.version, tests }));
  process.exitCode = tests.every(t => t.pass) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
