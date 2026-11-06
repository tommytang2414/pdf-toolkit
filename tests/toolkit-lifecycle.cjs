// Execute actual TSX with a deterministic React-hook host and controlled promises.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const ts = require('typescript');
const pdf = require('pdf-lib');
const root = path.resolve(__dirname,'..');
const pagePath = process.argv[2] || path.join(root,'app/toolkit/page.tsx');
const dropPath = process.argv[3] || path.join(root,'components/pdf/PdfDropzone.tsx');
const operationPath = process.argv[4] || path.join(root,'lib/pdf-operations.ts');
const defer = () => { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
function compile(file,requireModule) {
  const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInThisContext('(function(exports,require){'+code+'\n})')(exports,requireModule);return exports;
}
function host({drop=false,api={},render=async()=>[{pageIndex:0}],seed,parsed=pdf}={}) {
  let cursor=0,refCursor=0;const state=seed || (drop?[false,null]:[[{name:'A'}],[{pageIndex:0}],[0],new Map(),false,null,null,new Uint8Array([1])]);
  const refs=[],cleanups=[],urls=[];let effects=false;
  const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],v=>state[index]=typeof v==='function'?v(state[index]):v];},useRef(initial){const i=refCursor++;return refs[i] ||= {current:initial};},useCallback:fn=>fn,useEffect(fn){if(!effects){const cleanup=fn();if(cleanup)cleanups.push(cleanup);}}};
  const Dropzone=function PdfDropzone(){};
  const defaultApi={mergePdfs:async files=>files[0],deletePages:async bytes=>bytes,reorderPages:async bytes=>bytes,rotatePages:async bytes=>bytes,...api};
  function requireModule(name){
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
    if(name==='@/lib/pdf-operations')return defaultApi;
    if(name==='@/lib/pdf-renderer')return {renderAllPages:render};
    if(name==='@/hooks/useBlobUrl')return {useBlobUrl:()=>({create:bytes=>{urls.push(bytes);return 'blob:test';},revoke:()=>{}})};
    if(name==='@/components/pdf/PdfDropzone')return {default:Dropzone};
    if(name==='pdf-lib')return parsed;
    if(name==='@dnd-kit/core')return {useSensors:()=>[],useSensor:()=>({}),DndContext:'dnd'};
    if(name==='@dnd-kit/sortable')return {SortableContext:'sortable',arrayMove:(items,from,to)=>{const copy=[...items];copy.splice(to,0,...copy.splice(from,1));return copy;}};
    return new Proxy({},{get:()=>()=>null});
  }
  const Component=compile(drop?dropPath:pagePath,requireModule).default;
  const renderTree=()=>{cursor=0;refCursor=0;const tree=Component(drop?{onFiles:api.onFiles,multiple:true}:{});effects=true;return tree;};
  function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
  const locate=predicate=>nodes(renderTree()).find(predicate);
  return {state,urls,renderTree,unmount:()=>cleanups.forEach(fn=>fn()),download:()=>locate(n=>n.props?.onClick?.name==='handleDownload').props.onClick(),
    load:files=>locate(n=>n.type===Dropzone).props.onFiles(files),reset:()=>locate(n=>n.type==='button'&&n.props?.children==='Reset').props.onClick(),
    dropKey:()=>locate(n=>n.type===Dropzone).key,rotate:()=>locate(n=>n.props?.onRotateCW).props.onRotateCW(),drop:files=>renderTree().props.onDrop({preventDefault(){},dataTransfer:{files}})};
}
const rows=[];
async function test(id,fn){try{const actual=await fn();rows.push({id,actual,expected:true,pass:actual===true});}catch(e){rows.push({id,actual:{error:e.message},expected:true,pass:false});}}
(async()=>{
  await test('download-cannot-publish-after-new-load',async()=>{const download=defer(),thumb=defer();const h=host({api:{reorderPages:()=>download.promise},render:()=>thumb.promise});const a=h.download();const b=h.load([{bytes:new Uint8Array([2]),name:'B'}]);await tick();download.resolve(new Uint8Array([1]));await a;const safe=h.urls.length===0&&h.state[4]===true;thumb.resolve([{pageIndex:0,tag:'B'}]);await b;return safe&&h.state[7][0]===2;});
  await test('last-load-wins',async()=>{const a=defer(),b=defer();const h=host({render:bytes=>bytes[0]===2?a.promise:b.promise});const first=h.load([{bytes:new Uint8Array([2])}]);await tick();const second=h.load([{bytes:new Uint8Array([3])}]);await tick();b.resolve([{pageIndex:0,tag:'B'}]);await second;a.resolve([{pageIndex:0,tag:'A'}]);await first;return h.state[1][0].tag==='B'&&h.state[7][0]===3;});
  await test('reset-invalidates-pending-download',async()=>{const d=defer();const h=host({api:{reorderPages:()=>d.promise}});const task=h.download();h.reset();d.resolve(new Uint8Array([1]));await task;return h.urls.length===0&&h.state[6]===null&&h.state[4]===false;});
  await test('stale-failure-cannot-set-error',async()=>{const a=defer();const h=host({render:bytes=>bytes[0]===2?a.promise:Promise.resolve([{pageIndex:0,tag:'B'}])});const first=h.load([{bytes:new Uint8Array([2])}]);await tick();await h.load([{bytes:new Uint8Array([3])}]);a.reject(Error('old load'));await first;return h.state[5]===null&&h.state[1][0].tag==='B';});
  await test('edit-invalidates-pending-download',async()=>{const d=defer();const h=host({api:{reorderPages:()=>d.promise}});const task=h.download();h.rotate();d.resolve(new Uint8Array([1]));await task;return h.urls.length===0&&h.state[6]===null;});
  await test('unmount-invalidates-pending-download',async()=>{const d=defer();const h=host({api:{reorderPages:()=>d.promise}});const task=h.download();h.unmount();d.resolve(new Uint8Array([1]));await task;return h.urls.length===0;});
  await test('dropzone-last-selection-wins',async()=>{const slow=defer(),received=[];const h=host({drop:true,api:{onFiles:files=>received.push(files[0].name)},parsed:{PDFDocument:{load:async()=>({getPageCount:()=>1})}}});h.drop([{name:'A',type:'application/pdf',size:1,arrayBuffer:()=>slow.promise}]);h.drop([{name:'B',type:'application/pdf',size:1,arrayBuffer:async()=>new Uint8Array([2]).buffer}]);await tick();slow.resolve(new Uint8Array([1]).buffer);await tick();return received.join(',')==='B';});
  await test('reset-remounts-and-invalidates-pending-selection',async()=>{const slow=defer(),received=[];const page=host(),key=page.dropKey();const drop=host({drop:true,api:{onFiles:files=>received.push(files[0].name)},parsed:{PDFDocument:{load:async()=>({getPageCount:()=>1})}}});drop.drop([{name:'A',type:'application/pdf',size:1,arrayBuffer:()=>slow.promise}]);page.reset();if(page.dropKey()!==key)drop.unmount();slow.resolve(new Uint8Array([1]).buffer);await tick();return received.length===0;});
  const realApi=compile(operationPath,name=>{if(name!=='pdf-lib')throw Error('Import denied');return pdf;});
  for(const t of [
    {id:'reorder-and-rotate',widths:[100,200],angles:[0,0],order:[1,0],rotations:[[0,90]],expected:[[200,0],[100,90]]},
    {id:'delete-reorder-and-existing-angle',widths:[100,200,300],angles:[90,180,270],order:[2,0],rotations:[[0,90],[2,270]],expected:[[300,180],[100,180]]},
    {id:'negative-existing-angle',widths:[100,200],angles:[-270,0],order:[1,0],rotations:[[0,90]],expected:[[200,0],[100,180]]},
    {id:'three-separate-rotations',widths:[100,200,300],angles:[0,0,0],order:[2,0,1],rotations:[[0,90],[1,180],[2,270]],expected:[[300,270],[100,90],[200,180]]},
    {id:'zero-adjustment-preserves-angle',widths:[100,200],angles:[90,180],order:[1,0],rotations:[[0,0]],expected:[[200,180],[100,90]]},
  ])await test(t.id,async()=>{const input=await pdf.PDFDocument.create();t.widths.forEach((width,i)=>input.addPage([width,100]).setRotation(pdf.degrees(t.angles[i])));const bytes=await input.save();const h=host({api:realApi,seed:[[],t.widths.map((_,pageIndex)=>({pageIndex})),t.order,new Map(t.rotations),false,null,null,bytes]});await h.download();const out=await pdf.PDFDocument.load(h.urls[0]);return JSON.stringify(out.getPages().map(p=>[p.getWidth(),p.getRotation().angle]))===JSON.stringify(t.expected);});
  const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  console.log(JSON.stringify({node:process.version,typescript:ts.version,sources:{page:sha(pagePath),dropzone:sha(dropPath),operations:sha(operationPath)},harness_sha256:sha(__filename),tests:rows}));process.exitCode=rows.every(t=>t.pass)?0:1;
})().catch(e=>{console.error(e);process.exitCode=2;});
