// Step 1 of naming the performers of a hub with AI: write the file names of the videos that have no tags of their
// own yet into batches, for AI agents to read (see INSTRUCTIONS.md). Reads the hub, changes nothing.
//
// usage: node bin/performer-names/export.js <hub.vha2> <work folder> [number of batches, default 12]
//
// Writes `index.json` (which row is which video) and `batch_NN.tsv` (`id <TAB> folder <TAB> file name`).
// The agents write `result_NN.txt`; `merge.js` then puts the names into the hub as tags.

const fs = require('fs');
const path = require('path');

const [hubFile, workDir, batchesArg] = process.argv.slice(2);
if (!hubFile || !workDir) {
  console.error('usage: node bin/performer-names/export.js <hub.vha2> <work folder> [number of batches]');
  process.exit(1);
}

const hub = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
const videos = hub.images.filter((e) => e.cleanName !== '*FOLDER*' && !(e.tags && e.tags.length));
const rows = videos.map((e, i) => ({ id: i + 1, inputSource: e.inputSource, partialPath: e.partialPath, fileName: e.fileName }));

fs.mkdirSync(workDir, { recursive: true });
fs.writeFileSync(path.join(workDir, 'index.json'), JSON.stringify(rows));

const batches = Math.max(1, Math.min(parseInt(batchesArg || '12', 10), rows.length || 1));
const perBatch = Math.ceil(rows.length / batches);
for (let b = 0; b < batches; b++) {
  const lines = videos.slice(b * perBatch, (b + 1) * perBatch).map((e, i) => {
    const folder = e.partialPath.split('/').filter(Boolean).pop() || '-';
    return (b * perBatch + i + 1) + '\t' + folder + '\t' + e.cleanName.replace(/\t/g, ' ');
  });
  if (lines.length) {
    fs.writeFileSync(path.join(workDir, 'batch_' + String(b + 1).padStart(2, '0') + '.tsv'), lines.join('\n') + '\n');
  }
}

console.log(rows.length + ' videos without tags of their own, in ' + batches + ' batches of up to ' + perBatch + ', in ' + workDir);
