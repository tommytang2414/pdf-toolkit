// Preserve the frozen legacy cases, but give their deferred renderer mock the new abort contract.
// Actual PDF.js task cancellation is covered separately by toolkit-render-cancellation.cjs.
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const { createHash } = require('node:crypto');
const suites = { lifecycle: 'toolkit-lifecycle.cjs', errors: 'toolkit-edit-errors.cjs', boundary: 'toolkit-selection-boundary.cjs', mixed: 'toolkit-mixed-selection.cjs' };
if (!suites[process.argv[2]]) throw Error('Unknown frozen suite');
const target = path.join(__dirname, suites[process.argv[2]]); const basePath = path.join(__dirname, 'toolkit-lifecycle.cjs');
const original = fs.readFileSync(basePath, 'utf8'); const needle = 'renderAllPages:render';
if (original.split(needle).length !== 2) throw Error('Frozen host shape changed');
const projected = original.replace(needle, `renderAllPages:(bytes,maxPx,concurrency,signal)=>{
  if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  const result=Promise.resolve(render(bytes,maxPx,concurrency,signal));
  if(!signal)return result;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException('Cancelled','AbortError'));
    signal.addEventListener('abort',abort,{once:true});
    result.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}`);
const wrappedFs = { ...fs, readFileSync(file, options) {
  if (path.resolve(String(file)) !== basePath) return fs.readFileSync(file, options);
  return typeof options === 'string' || options?.encoding ? projected : Buffer.from(projected);
} };
const sha = data => createHash('sha256').update(data).digest('hex');
const provenance = { adapter_sha256: sha(fs.readFileSync(__filename)), frozen_suite_sha256: sha(fs.readFileSync(target)), frozen_host_sha256: sha(original), projected_host_sha256: sha(projected), mock_contract: 'Deferred legacy mock accepts AbortSignal; no actual resource-cancellation claim from this adapter' };
const wrappedConsole = { ...console, log(value) { console.log(JSON.stringify({ ...JSON.parse(value), cancellation_host: provenance })); } };
const executionProcess = { argv: ['node', target], version: process.version, set exitCode(value) { process.exitCode = value; } };
const source = target === basePath ? projected : fs.readFileSync(target, 'utf8');
vm.runInThisContext('(function(require,__dirname,__filename,process,console){' + source + '\n})', { filename: target })(name => name === 'node:fs' ? wrappedFs : require(name), __dirname, target, executionProcess, wrappedConsole);
