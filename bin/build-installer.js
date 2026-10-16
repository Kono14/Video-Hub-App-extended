// Builds the Windows installer (after `npm run build:prod`) and stamps it with the version of this build:
// `version` and `forkBuild` from node/main-globals.ts, e.g. 3.3.0.1 -- shown in the file properties of the
// installer and of the installed app, and by `bin/deploy.ps1`
//
// usage: node bin/build-installer.js [output folder, default `release-local`]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const outputDir = process.argv[2] || 'release-local';

const globals = fs.readFileSync(path.join(projectRoot, 'node', 'main-globals.ts'), 'utf8');
const forkBuild = /forkBuild:\s*(\d+)/.exec(globals);

if (!forkBuild) {
  console.error('No `forkBuild: <number>` found in node/main-globals.ts');
  process.exit(1);
}

const args = ['electron-builder', 'build', '--win', 'nsis', '-c.directories.output=' + outputDir, '-c.buildNumber=' + forkBuild[1]];
console.log('npx ' + args.join(' '));

// `npx` is a `.cmd` on Windows, which Node only starts through a shell
const result = spawnSync('npx', args, { cwd: projectRoot, stdio: 'inherit', shell: true });

process.exit(result.status === null ? 1 : result.status);
