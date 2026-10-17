import type { ScreenshotSettings, InputSources } from '../interfaces/final-object.interface';

// For release, update 4 values:                                                                          <---- !!! RELEASE !!!
//
// `demo: true,`                 -- below
// `version: 'X.X.X',`           -- below
// `"version": "X.X.X",`         -- package.json
// `"productName": "... Demo"    -- electron-builder.json

export const GLOBALS: VhaGlobals = {
  angularApp: null,            // reference used to send messages back to Angular App
  currentlyOpenVhaFile: '',    // OFFICAL DECREE IN NODE WHICH FILE IS CURRENTLY OPEN !!!
  debug: false,
  demo: false,                 // change to `true` during release                                         <---- !!! RELEASE !!!
  forkBuild: 7,                // builds of this fork on top of `version` (3.3.0.1, 3.3.0.2, ...) -- one more for every
                               // installer handed over; back to 1 when `version` changes. `bin/build-installer.js` reads it
  hubName: 'untitled',         // in case user doesn't name their hub any name
  macVersion: false,           // auto updated by `main.ts`
  readyToQuit: false,          // hack to quit gracefully
  selectedOutputFolder: '',
  selectedSourceFolders: {},
  settingsPath: '',            // to differentiate between standard & Windows Portable settings location
  version: '3.3.0',            // see instructions above to update `package.json` in tandem               <---- !!! RELEASE !!!!
  vhaFileVersion: 3,
  viewerInstance: false,       // started while another instance runs: shows hubs, never writes, scans or extracts
  winRef: null,
  screenshotSettings: {
    clipHeight: 144,           // default clip height
    clipSnippetLength: 1,      // the length of each snippet in the clip
    clipSnippets: 0,           // the number of video snippets in every clip; 0 == no clip extracted
    fixed: true,               // true => N screenshots per video; false => 1 screenshot every N minutes
    height: 288,
    n: 10,
  },
  additionalExtensions: [],
};

export interface VhaGlobals {
  additionalExtensions: string[];
  angularApp: any;
  currentlyOpenVhaFile: string;
  debug: boolean;
  demo: boolean;
  forkBuild: number;
  hubName: string;
  macVersion: boolean;
  readyToQuit: boolean;
  screenshotSettings: ScreenshotSettings;
  selectedOutputFolder: string;
  selectedSourceFolders: InputSources;
  settingsPath: string;
  version: string;
  vhaFileVersion: number;
  viewerInstance: boolean;
  winRef: any;
}
