// Reuse the actual-handler harness, changing only synthetic input initialization.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pdf-rotation-'));
const profile = path.join(folder, 'profile.json');
const cases = [
  { id: 'existing-90-plus-90', widths: [100,200], initial: [90,0], order: [1,0], rotations: [[0,90]], expected: [[200,0],[100,180]] },
  { id: 'existing-180-plus-270', widths: [100,200], initial: [180,0], order: [1,0], rotations: [[0,270]], expected: [[200,0],[100,90]] },
  { id: 'existing-270-plus-270', widths: [100,200], initial: [270,0], order: [1,0], rotations: [[0,270]], expected: [[200,0],[100,180]] },
  { id: 'existing-negative-rotation', widths: [100,200], initial: [-270,0], order: [1,0], rotations: [[0,90]], expected: [[200,0],[100,180]] },
  { id: 'existing-zero-adjustment', widths: [100,200], initial: [90,180], order: [1,0], rotations: [[0,0]], expected: [[200,180],[100,90]] },
  { id: 'existing-delete-reorder', widths: [100,200,300], initial: [90,180,270], order: [2,0], rotations: [[0,90],[2,270]], expected: [[300,180],[100,180]] },
];
fs.writeFileSync(profile, JSON.stringify(cases));
process.on('exit', () => fs.rmSync(folder, { recursive: true, force: true }));
const original = fs.readFileSync(path.join(__dirname,'toolkit-composition.cjs'),'utf8');
const anchor = 't.widths.forEach(width => doc.addPage([width,100]));';
if (original.split(anchor).length !== 2) throw Error('Synthetic fixture initialization anchor changed');
process.argv[4] = profile;
module._compile(original.replace(anchor, 't.widths.forEach((width,index) => doc.addPage([width,100]).setRotation(pdf.degrees(t.initial[index])));'), __filename);
