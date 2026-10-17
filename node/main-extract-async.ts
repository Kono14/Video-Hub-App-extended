// async & chokidar Code written by Cal2195
// Was originally added to `main-extract.ts` but was moved here for clarity

const { powerSaveBlocker } = require('electron');
const async = require('async');
const chokidar = require('chokidar');
import * as path from 'path';
import type { FSWatcher } from 'chokidar'; // probably the correct type for chokidar.watch() object
const fs = require('fs');
import type { Stats } from 'fs';
import { fdir } from 'fdir';

import { GLOBALS } from './main-globals';

import type { ImageElement, ImageElementPlus } from '../interfaces/final-object.interface';
import { acceptableFiles } from './main-filenames';
import { extractAll, maxParallelExtractions } from './main-extract';
import { sendCurrentProgress, insertTemporaryFieldsSingle, extractMetadataAsync, cleanUpFileName } from './main-support';

export interface TempMetadataQueueObject {
  fullPath: string;
  inputSource: number;
  name: string;
  partialPath: string;
}

// ONLY FOR LOGGING
const { performance } = require('perf_hooks');

// =====================================================================================================================
// The three queues will be `QueueObject` - https://caolan.github.io/async/v3/docs.html#QueueObject

// meta queue
let metadataQueue;      // QueueObject - accepts a `.push(TempMetadataQueueObject)`
let metaDone = 0;
let metaExtractionStartTime = 0;

// thumb queue
let thumbQueue;         // QueueObject
let thumbsDone = 0;
let thumbExtractionStartTime = 0;
const thumbsInProgress: Set<string> = new Set(); // hashes being extracted -- duplicate files share a hash and its screenshots

// delete queue
let deleteThumbQueue;   // QueueObject
let numberOfThumbsDeleted = 0;

// =====================================================================================================================

// It is faster to check if key exists than searching through an array.
// full paths to videos we have metadata for in Angular -- the value is the `inputSource` the video belongs to
let alreadyInAngular: Map<string, number> = new Map();

// These two are together:
const watcherMap:       Map<number, FSWatcher> = new Map();
let allFoundFilesMap: Map<number, Map<string, 1>> = new Map();
// both these numbers     ^^^^^^ match up - they refer to the same `inputSource`

// Folders on a network drive are not watched with `chokidar`: it opens a watch handle for every single file,
// one blocking network call each -- thousands of files froze the app for minutes. They are re-scanned on a timer instead:
// a scan of 13,000 files on a NAS took little more than a second, so every two minutes costs next to nothing
const networkRescanInterval = 2 * 60 * 1000;
const rescanTimerMap:   Map<number, NodeJS.Timeout> = new Map(); // key is `inputSource`
const watchRequestMap:  Map<number, number> = new Map();         // latest request to watch each `inputSource`
const scansInProgress:  Set<number> = new Set();                 // `inputSource` currently scanned by `fdir`
let watchRequestCount = 0;

// Goes up whenever a hub is opened: a scan may still be running then (slow network drive), and what it
// finds belongs to the hub it was started for -- same `inputSource` number, different folder
let hubGeneration = 0;

// Windows system folders that are never scanned -- a deleted video in the recycle bin is not part of the collection
const systemFolders: string[] = ['$recycle.bin', 'system volume information'];

// =====================================================================================================================

// Miscellaneous
let preventSleepIds: number[] = []; // prevent and allow sleep

// =====================================================================================================================

resetAllQueues();

/**
 * Reset all three queues:
 *  - Meta queue
 *  - Thumb queue
 *  - Delet queue
 */
export function resetAllQueues(): void {

  allowSleep();

  // kill all previeous
  if (thumbQueue && typeof thumbQueue.kill === 'function') {
    thumbQueue.kill();
  }
  if (metadataQueue && typeof metadataQueue.kill === 'function') {
    metadataQueue.kill();
  }
  if (deleteThumbQueue && typeof deleteThumbQueue.kill === 'function') {
    deleteThumbQueue.kill();
  }

  // Meta queue ========================================================================================================
  metaDone = 0;
  metaExtractionStartTime = 0;

  metadataQueue = async.queue(metadataQueueRunner, maxParallelExtractions); // number of parallel worker functions

  metadataQueue.drain(() => {

    thumbQueue.resume();

    // When every new file turned out unreadable (damaged, still downloading) there is nothing to extract:
    // the `thumbQueue` never drains, so Angular would show the import as running forever
    if (thumbQueue.idle()) {
      sendCurrentProgress(1, 1, 'done');
      allowSleep();
    }

    logPerformance('META QUEUE took ', metaExtractionStartTime);
  });

  // Thumbs queue ======================================================================================================
  thumbsDone = 0;
  thumbExtractionStartTime = 0;

  thumbsInProgress.clear();

  thumbQueue = async.queue(thumbQueueRunner, maxParallelExtractions); // number of `ffmpeg` processes at once

  thumbQueue.drain(() => {

    logPerformance('THUMB QUEUE took ', thumbExtractionStartTime);

    thumbsDone = 0;
    sendCurrentProgress(1, 1, 'done');
    console.log('thumbnail extraction complete!');
    allowSleep();
  });

  // Delete queue ======================================================================================================
  deleteThumbQueue = async.queue(deleteThumbQueueRunner, 1);

  deleteThumbQueue.drain(() => {
    console.log('all screenshots now deleted');
    GLOBALS.angularApp.sender.send('number-of-screenshots-deleted', numberOfThumbsDeleted);
  });
}

/**
 * Extraction queue runner
 * Runs for every element in the `thumbQueue`
 * @param element -- ImageElement to extract screenshots for
 * @param done    -- callback to indicate the current extraction finished
 */
function thumbQueueRunner(element: ImageElement, done): void {
  const queue = thumbQueue; // a cancelled import replaces the queue while its last extractions still run
  const screenshotOutputFolder: string = path.join(GLOBALS.selectedOutputFolder, 'vha-' + GLOBALS.hubName);
  const shouldExtractClips: boolean = GLOBALS.screenshotSettings.clipSnippets > 0;

  if (thumbsInProgress.has(element.hash)) {
    done(); // another worker is writing these very files right now
    return;
  }

  hasAllThumbs(element.hash, screenshotOutputFolder, shouldExtractClips)
    .then(() => {
      done();
    })
    .catch(() => {
      sendCurrentProgress(
        thumbsDone,
        thumbsDone + thumbQueue.length() + thumbQueue.running(),
        'importingScreenshots'
      );

      thumbsInProgress.add(element.hash);

      extractAll(
        element,
        GLOBALS.selectedSourceFolders[element.inputSource].path,
        screenshotOutputFolder,
        GLOBALS.screenshotSettings,
        () => {
          thumbsInProgress.delete(element.hash);

          if (queue === thumbQueue) {
            // A video counts as done when it is finished, not when it is started: with several videos at once
            // the count would run ahead otherwise, and stand still while the last videos are extracted.
            // This worker still counts as running
            thumbsDone++;
            sendCurrentProgress(
              thumbsDone,
              thumbsDone + thumbQueue.length() + thumbQueue.running() - 1,
              'importingScreenshots'
            );
          }

          done();
        }
      );
    });
}

/**
 * Send element back to Angular; if any screenshots missing, queue it for extraction
 * @param imageElement
 */
function sendNewVideoMetadata(imageElement: ImageElementPlus): void {

  alreadyInAngular.set(imageElement.fullPath, imageElement.inputSource);

  delete imageElement.fullPath; // downgrade to `ImageElement` from `ImageElementPlus`

  const elementForAngular = insertTemporaryFieldsSingle(imageElement);
  GLOBALS.angularApp.sender.send('new-video-meta', elementForAngular);

  if (thumbExtractionStartTime === 0) {
    thumbExtractionStartTime = performance.now();
  }

  thumbQueue.push(imageElement);
}

/**
 * Create empty element, extract and update metadata, send over to Angular
 * @param fileInfo - various stat metadata about the file
 * @param done
 */
export function metadataQueueRunner(file: TempMetadataQueueObject, done): void {

  if (metaExtractionStartTime === 0) {
    metaExtractionStartTime = performance.now();
  }

  if (GLOBALS.demo && alreadyInAngular.size >= 50) {
    console.log(' - DEMO LIMIT REACHED - CANCELING SCAN !!!');
    sendCurrentProgress(50, 50, 'done');
    metadataQueue.kill();
    thumbQueue.resume();
    return;
  }

  sendCurrentProgress(metaDone, metaDone + metadataQueue.length() + metadataQueue.running(), 'importingMeta');
  metaDone++;

  extractMetadataAsync(file.fullPath, GLOBALS.screenshotSettings)
    .then((imageElement: ImageElementPlus) => {
      imageElement.cleanName = cleanUpFileName(file.name);
      imageElement.fileName = file.name;
      imageElement.fullPath = file.fullPath; // insert this converting `ImageElement` to `ImageElementPlus`
      imageElement.inputSource = file.inputSource;
      imageElement.partialPath = file.partialPath;
      sendNewVideoMetadata(imageElement);
      done();
    }, () => {
      console.log('could not read, skipped:', file.fullPath);
      done(); // error, just continue
    });

}

/**
 * Use `fdir` to quickly generate file list and add it to `metadataQueue`
 * @param inputDir    -- full path to the input folder
 * @param inputSource -- the number corresponding to the `inputSource` in ImageElement -- must be set!
 */
function superFastSystemScan(inputDir: string, inputSource: number): void {

  if (scansInProgress.has(inputSource)) {
    return; // the previous scan of this folder is still running (slow or sleeping network drive)
  }
  scansInProgress.add(inputSource);

  const generation: number = hubGeneration;

  GLOBALS.angularApp.sender.send('started-watching-this-dir', inputSource);

  metadataQueue.pause();
  thumbQueue.pause();

  const crawler = new fdir()
    .exclude((dir: string) => isIgnoredFolder(dir)) // .exclude `dir` is the folder name, not full path
    .withFullPaths()
    .crawl(inputDir);

  const t0 = performance.now(); // LOGGING

  crawler.withPromise().then((files: string[]) => {

    if (generation !== hubGeneration) {
      return; // another hub was opened meanwhile
    }

    // LOGGING =====================================================================================
    logPerformance('scan took ', t0);
    console.log('Found ', files.length, ' files in given directory');
    // =============================================================================================

    const allAcceptableFiles: string[] = [...acceptableFiles, ...GLOBALS.additionalExtensions];

    const foundNow: Map<string, 1> = new Map();

    files.forEach((fullPath: string) => {

      const parsed = path.parse(fullPath);

      if (!allAcceptableFiles.includes(parsed.ext.substr(1).toLowerCase())) {
        return;
      }

      foundNow.set(fullPath, 1);

      if (alreadyInAngular.has(fullPath)) {
        return;
      }

      const partial: string = path.relative(inputDir, parsed.dir).replace(/\\/g, '/');

      metadataQueue.push({
        fullPath: fullPath,
        inputSource: inputSource,
        name: parsed.base,
        partialPath: '/' + partial,
      });

    });

    return reportFilesFound(inputDir, inputSource, foundNow);

  }).catch((err) => {
    console.log('scan failed', inputDir, err);
  }).then(() => {
    if (generation !== hubGeneration) {
      return; // the queues and `scansInProgress` now belong to the hub opened meanwhile
    }
    scansInProgress.delete(inputSource);
    resumeQueuesAfterScan();
  });

}

/**
 * Tell Angular which videos of a source folder are on disk -- it removes from the hub whatever is not listed,
 * and with it the tags and ratings. A scan leaves out more than what was deleted: folders it could not read
 * are skipped without an error, and a share or volume that is not mounted looks like an empty folder.
 * So a video the hub knows but the scan did not find is only left out when it is verifiably deleted.
 *
 * @param inputDir    -- full path to the input folder
 * @param inputSource -- the number corresponding to the `inputSource` in ImageElement
 * @param foundNow    -- full paths to the videos the scan found; the videos to keep are added to it
 */
function reportFilesFound(inputDir: string, inputSource: number, foundNow: Map<string, 1>): Promise<void> {

  const generation: number = hubGeneration;
  const missing: string[] = [];

  alreadyInAngular.forEach((source: number, fullPath: string) => {
    if (source === inputSource && !foundNow.has(fullPath)) {
      missing.push(fullPath);
    }
  });

  // Not a single video where the hub has some: far more likely unreachable than emptied -- keep them all
  const nothingFound: boolean = foundNow.size === 0 && missing.length > 0;

  return (nothingFound ? Promise.resolve<string[]>([]) : findDeleted(missing, inputDir)).then((deleted: string[]) => {

    if (generation !== hubGeneration) {
      return; // another hub was opened while the folders were checked
    }

    const deletedSet: Set<string> = new Set(deleted);

    missing.forEach((fullPath: string) => {
      if (deletedSet.has(fullPath)) {
        alreadyInAngular.delete(fullPath); // gone -- import it again if it ever comes back
      } else {
        foundNow.set(fullPath, 1);
      }
    });

    if (missing.length) {
      console.log(inputDir, '-- videos missing from the scan:', missing.length, 'of them deleted:', deleted.length);
    }

    allFoundFilesMap.set(inputSource, foundNow);

    GLOBALS.angularApp.sender.send('all-files-found-in-dir', inputSource, foundNow);
  });
}

/**
 * Of the videos a scan did not find, return those that are no longer part of the collection:
 *  - a video the scan skips on purpose (ignored folder, file type no longer accepted)
 *  - a video missing from the listing of its folder, or whose folder is missing from the listing of the folder above
 * When a folder on the way can not be read the video is not returned -- being unreadable is not being deleted
 *
 * @param missing  -- full paths to the videos the scan did not find
 * @param inputDir -- full path to the input folder; nothing is concluded from the folders above it
 */
function findDeleted(missing: string[], inputDir: string): Promise<string[]> {

  const allAcceptableFiles: string[] = [...acceptableFiles, ...GLOBALS.additionalExtensions];
  const rootPath: string = path.resolve(inputDir);

  const listings: Map<string, Promise<Set<string> | NodeJS.ErrnoException>> = new Map(); // one per folder
  const verdicts: Map<string, Promise<boolean>> = new Map();                               // one per file or folder

  const list = (folder: string): Promise<Set<string> | NodeJS.ErrnoException> => {
    if (!listings.has(folder)) {
      listings.set(folder, fs.promises.readdir(folder).then(
        (names: string[]) => new Set(names),
        (err: NodeJS.ErrnoException) => err
      ));
    }
    return listings.get(folder);
  };

  const isDeleted = (itemPath: string): Promise<boolean> => {
    if (!verdicts.has(itemPath)) {
      const parent: string = path.dirname(itemPath);

      verdicts.set(itemPath, list(parent).then((listing: Set<string> | NodeJS.ErrnoException) => {
        if (listing instanceof Set) {
          return !listing.has(path.basename(itemPath));
        }
        if (parent === rootPath || parent === itemPath) {
          return false; // the input folder itself can not be read (or we ran out of path)
        }
        if (listing.code === 'ENOENT' || listing.code === 'ENOTDIR') {
          return isDeleted(parent); // the folder is not there -- deleted, if the folder above says so
        }
        return false; // no permission, busy, timed out, ...
      }));
    }
    return verdicts.get(itemPath);
  };

  const isScanned = (fullPath: string): boolean => {
    const segments: string[] = path.relative(rootPath, fullPath).split(path.sep);
    const fileName: string = segments.pop();
    return allAcceptableFiles.includes(path.extname(fileName).substr(1).toLowerCase())
           && !segments.some((folderName: string) => isIgnoredFolder(folderName));
  };

  return Promise.all(missing.map((fullPath: string) => {
    return isScanned(fullPath) ? isDeleted(path.resolve(fullPath)) : Promise.resolve(true);
  })).then((results: boolean[]) => {
    return missing.filter((fullPath: string, index: number) => results[index]);
  });
}

/**
 * Whether to skip a folder while scanning: the app's own screenshot folders (`vha-...`) and Windows system folders
 * @param folderName -- name of the folder, not its full path
 */
function isIgnoredFolder(folderName: string): boolean {
  return folderName.startsWith('vha-') || systemFolders.includes(folderName.toLowerCase());
}

/**
 * Resume the queues paused at the start of a scan
 * The `thumbQueue` normally resumes when the `metadataQueue` drains -- but a scan that finds nothing new
 * never drains it, and screenshots still waiting to be extracted would stay paused forever
 */
function resumeQueuesAfterScan(): void {
  metadataQueue.resume();

  if (metadataQueue.idle()) {
    thumbQueue.resume();
  }
}

/**
 * Whether the folder is on a network drive: a network address or (on Windows) a drive letter mapped to one
 * @param inputDir -- full path to input folder
 */
function isNetworkFolder(inputDir: string): Promise<boolean> {
  // WARNING - there are other ways to have a network address that are not accounted here !!!
  if (inputDir.startsWith('//') || inputDir.startsWith('\\\\')) {
    return Promise.resolve(true);
  }

  if (process.platform !== 'win32') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    // a mapped drive letter resolves to its network address, which starts with two backslashes
    fs.realpath.native(inputDir, (err, resolvedPath: string) => {
      resolve(!!err || resolvedPath.startsWith('\\\\')); // when in doubt re-scan, it works for any folder
    });
  });
}

/**
 * Keep a folder on a network drive up to date: scan it now and again every `networkRescanInterval`
 * @param inputDir    -- full path to input folder
 * @param inputSource -- the number corresponding to the `inputSource` in ImageElement -- must be set!
 */
function watchByRescanning(inputDir: string, inputSource: number): void {

  superFastSystemScan(inputDir, inputSource);

  rescanTimerMap.set(inputSource, setInterval(() => {
    fs.access(inputDir, fs.constants.R_OK, (err: any) => {
      if (!err) { // else not reachable right now -- try again next time
        superFastSystemScan(inputDir, inputSource);
      }
    });
  }, networkRescanInterval));
}

/**
 * Create a new `chokidar` watcher for a particular directory
 * @param inputDir    -- full path to input folder
 * @param inputSource -- the number corresponding to the `inputSource` in ImageElement -- must be set!
 * @param persistent  -- whether to continue watching after the initial scan
 */
export function startFileSystemWatching(inputDir: string, inputSource: number, persistent: boolean): void {

  // only run `chokidar` if `persistent`
  if (!persistent) {
    superFastSystemScan(inputDir, inputSource);
    return;
  }

  const watchRequest: number = ++watchRequestCount;
  watchRequestMap.set(inputSource, watchRequest);

  isNetworkFolder(inputDir).then((onNetwork: boolean) => {
    if (watchRequestMap.get(inputSource) !== watchRequest) {
      return; // stopped or restarted meanwhile
    }
    if (onNetwork) {
      watchByRescanning(inputDir, inputSource);
    } else {
      watchWithChokidar(inputDir, inputSource);
    }
  });
}

/**
 * Work around a bug of `chokidar` (4.0.3, and 5.0.0 as well) that strikes when the folder watched is the root
 * of a drive, like `D:\`
 *
 * A drive root is its own parent folder, so `chokidar` lists it inside itself, under an empty name. Once it has
 * read the root it finds no entry of that name there and takes the root for deleted -- along with everything it
 * has come across by then: it reports those files as deleted and no longer tracks them, so the next real
 * deletion among them goes unnoticed. At one start of the app that were 369 videos, the first 16 to 48 of
 * twelve folders
 *
 * `_remove` is internal to `chokidar` -- should it ever go, this does nothing
 * @param watcher
 */
function ignoreRemovalOfRoot(watcher: FSWatcher): void {
  const internals: any = watcher;

  if (typeof internals._remove !== 'function') {
    return;
  }

  const remove = internals._remove.bind(watcher);

  internals._remove = (directory: string, item: string, isDirectory?: boolean): void => {
    if (item === '') {
      return; // "the folder inside itself" -- no file or folder has an empty name
    }
    remove(directory, item, isDirectory);
  };
}

/**
 * Watch a folder on a local drive with `chokidar`
 * @param inputDir    -- full path to input folder
 * @param inputSource -- the number corresponding to the `inputSource` in ImageElement -- must be set!
 */
function watchWithChokidar(inputDir: string, inputSource: number): void {

  const persistent = true;

  const t0 = performance.now();

  console.log('================================================================');
  console.log('SHOULD ONLY RUN ON PERSISTENT SCAN !!!');

  console.log('starting watcher ', inputSource, typeof(inputSource), inputDir);

  GLOBALS.angularApp.sender.send('started-watching-this-dir', inputSource);

  const rootPath: string = path.resolve(inputDir);

  const watcherConfig = {
    cwd: inputDir,
    disableGlobbing: true,
    // `chokidar` v4 dropped globs -- the old `'vha-*'` matched nothing, so the screenshot folders were scanned too
    // skip the same folders as `superFastSystemScan` does
    ignored: (itemPath: string, stats?: Stats) => !!stats
                                                  && stats.isDirectory()
                                                  && isIgnoredFolder(path.basename(itemPath))
                                                  && path.resolve(itemPath) !== rootPath,
    ignorePermissionErrors: true, // skip folders we may not read (e.g. `System Volume Information`, `$RECYCLE.BIN`)
    persistent: true, // NOTE: if `!persistent` we use `superFastSystemScan()` instead !!!
  };

  const watcher: FSWatcher = chokidar.watch(inputDir, watcherConfig);
  ignoreRemovalOfRoot(watcher);

  const allAcceptableFiles: string[] = [...acceptableFiles, ...GLOBALS.additionalExtensions];

  metadataQueue.pause();
  thumbQueue.pause();

  watcher
    .on('error', (err) => {
      // without a listener `chokidar` throws on any error and never emits `ready` -- the scan would never finish
      console.log('watcher error', inputSource, err);
    })
    .on('add', (filePath: string) => {

      const ext = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();

      if (!allAcceptableFiles.includes(ext)) {
        return;
      }

      const subPath = ('/' + filePath.replace(/\\/g, '/')).replace('//', '/');
      const partialPath = subPath.substring(0, subPath.lastIndexOf('/'));
      const fileName = subPath.substring(subPath.lastIndexOf('/') + 1);
      const fullPath = path.join(inputDir, partialPath, fileName);

      if (!allFoundFilesMap.has(inputSource)) {
        allFoundFilesMap.set(inputSource, new Map());
      }
      allFoundFilesMap.get(inputSource).set(fullPath, 1);

      if (alreadyInAngular.has(fullPath)) {
        return;
      }

      const newItem: TempMetadataQueueObject = {
        fullPath: fullPath,
        inputSource: inputSource,
        name: fileName,
        partialPath: partialPath,
      };

      metadataQueue.push(newItem);
    })
    .on('unlink', (partialFilePath: string) => {    // note: this happens even when file is renamed!
      const basePath: string = GLOBALS.selectedSourceFolders[inputSource].path;
      const fullPath: string = path.join(basePath, partialFilePath);
      // `chokidar` also reports files that are still there (seen on Windows) -- removing those from the hub
      // loses their tags and ratings, so only believe it when the folder no longer lists the file.
      // Not `fs.access`: where upper and lower case do not matter it still finds a file whose name only changed
      // case -- the old entry stayed and the new name was imported as a second video without the tags
      findDeleted([fullPath], basePath).then((deleted: string[]) => {
        if (!deleted.length) {
          console.log('reported as deleted but still present:', partialFilePath);
          return;
        }
        console.log(' !!! FILE DELETED, updating Angular:', partialFilePath);
        GLOBALS.angularApp.sender.send('single-file-deleted', inputSource, partialFilePath);
        // remove element from `alreadyInAngular`
        alreadyInAngular.delete(fullPath);
      });
      // note: there is no need to watch for `unlinkDir` since `unlink` fires for every file anyway!
    })
    .on('ready', () => {
      console.log('Finished scanning', inputSource);

      resumeQueuesAfterScan();

      reportFilesFound(inputDir, inputSource, allFoundFilesMap.get(inputSource) || new Map());

      if (persistent) {
        console.log('^^^^^^^^ - CONTINUING to watch this directory!');
      } else {
        console.log('^^^^^^^^ - stopping watching this directory');
        watcher.close();  // chokidar seems to disregard `persistent` when `fsevents` is not enabled
      }

      logPerformance('Chokidar took ', t0);
    });

  watcherMap.set(inputSource, watcher);
}

/**
 * Close out all the wathers
 * reset the alreadyInAngular
 * @param finalArray
 */
export function resetWatchers(finalArray: ImageElement[]): void {

  // close every old watcher and every re-scan timer
  [watcherMap, rescanTimerMap, watchRequestMap].forEach((map: Map<number, any>) => {
    Array.from(map.keys()).forEach((key: number) => {
      closeWatcher(key);
    });
  });

  hubGeneration++;
  scansInProgress.clear(); // a scan still running is for the previous hub -- it must not hold up this one

  alreadyInAngular = new Map();

  allFoundFilesMap = new Map();

  finalArray.forEach((element: ImageElement) => {
    const fullPath: string = path.join(
      GLOBALS.selectedSourceFolders[element.inputSource].path,
      element.partialPath,
      element.fileName
    );

    alreadyInAngular.set(fullPath, element.inputSource);
  });
}

/**
 * Close the old watcher
 * happens when opening a new hub (or user toggles the `watch` near folder)
 * @param inputSource
 */
export function closeWatcher(inputSource: number): void {
  console.log('stop watching', inputSource);
  watchRequestMap.delete(inputSource);
  if (rescanTimerMap.has(inputSource)) {
    clearInterval(rescanTimerMap.get(inputSource));
    rescanTimerMap.delete(inputSource);
  }
  if (watcherMap.has(inputSource)) {
    console.log('closing ', inputSource);
    watcherMap.get(inputSource).close().then(() => {
      console.log(inputSource, ' closed!');
      // do nothing
    });
  }
}

/**
 * Start old watcher
 * happens when user toggles the `watch` near folder
 * @param inputSource
 * @param folderPath
 */
export function startWatcher(inputSource: number, folderPath: string, persistent: boolean): void {
  console.log('start watching !!!!', inputSource, typeof(inputSource), folderPath, persistent);

  GLOBALS.selectedSourceFolders[inputSource] = {
    path: folderPath,
    watch: persistent,
  };

  preventSleep();
  startFileSystemWatching(folderPath, inputSource, persistent);
}

/**
 * Check if thumbnail, flimstrip, and clip is present
 * return boolean
 * @param fileHash           - unique identifier of the file
 * @param screenshotFolder   - path to where thumbnails are
 * @param shouldExtractClips - whether or not to extract clips
 */
function hasAllThumbs(
  fileHash: string,
  screenshotFolder: string,
  shouldExtractClips: boolean
): Promise<boolean> {
  return new Promise((resolve, reject) => {

    const thumb: string =     path.join(screenshotFolder, '/thumbnails/', fileHash + '.jpg');
    const filmstrip: string = path.join(screenshotFolder, '/filmstrips/', fileHash + '.jpg');
    const clip: string =      path.join(screenshotFolder, '/clips/',      fileHash + '.mp4');
    const clipThumb: string = path.join(screenshotFolder, '/clips/',      fileHash + '.jpg');

    Promise.all([
      fs.promises.access(thumb, fs.constants.F_OK),
      fs.promises.access(filmstrip, fs.constants.F_OK),
      shouldExtractClips
        ? fs.promises.access(clip, fs.constants.F_OK)
        : 'ok',
      shouldExtractClips
        ? fs.promises.access(clipThumb, fs.constants.F_OK)
        : 'ok'
    ])
      .then(() => {
        resolve(true);
      })
      .catch(() => {
        reject();
      });
  });
}

/**
 * The videos that lack a thumbnail, a filmstrip or (if wanted) a clip -- every `hash` only once
 *
 * Lists the screenshot folders once instead of asking for the files of each video in turn:
 * that way the queue holds nothing but real work, and its length tells how much of it is left
 * @param fullArray          - ImageElement array
 */
function elementsWithoutThumbs(fullArray: ImageElement[]): Promise<ImageElement[]> {
  const screenshotOutputFolder: string = path.join(GLOBALS.selectedOutputFolder, 'vha-' + GLOBALS.hubName);
  const shouldExtractClips: boolean = GLOBALS.screenshotSettings.clipSnippets > 0;

  const filesIn = (subfolder: string): Promise<Set<string>> => {
    return fs.promises.readdir(path.join(screenshotOutputFolder, subfolder)).then((names: string[]) => new Set(names));
  };

  return Promise.all([filesIn('thumbnails'), filesIn('filmstrips'), shouldExtractClips ? filesIn('clips') : null])
    .then(([thumbnails, filmstrips, clips]: Set<string>[]) => {
      const seen: Set<string> = new Set();

      return fullArray.filter((element: ImageElement) => {
        if (seen.has(element.hash)) {
          return false;
        }
        seen.add(element.hash);

        return !thumbnails.has(element.hash + '.jpg')
            || !filmstrips.has(element.hash + '.jpg')
            || (clips !== null && !(clips.has(element.hash + '.mp4') && clips.has(element.hash + '.jpg')));
      });
    })
    .catch(() => {
      return fullArray; // a folder could not be listed: the queue checks every video on its own, as it used to
    });
}

/**
 * Send all `imageElements` that lack a screenshot to the `thumbQueue`
 * @param fullArray          - ImageElement array
 */
export function extractAnyMissingThumbs(fullArray: ImageElement[]): void {
  const queue = thumbQueue;

  elementsWithoutThumbs(fullArray).then((missing: ImageElement[]) => {
    if (queue !== thumbQueue || missing.length === 0) {
      return; // the import was cancelled or another hub opened meanwhile -- or there is nothing to do
    }

    preventSleep();
    missing.forEach((element: ImageElement) => {
      thumbQueue.push(element);
    });
  });
}

/**
 * !!! WARNING !!! THIS FUNCTION WILL DELETE STUFF !!!
 *
 * Scan the provided directory and delete any file not in `hashesPresent`
 * @param hashesPresent
 * @param directory
 */
export function removeThumbnailsNotInHub(hashesPresent: Map<string, 1>, directory: string): void {

  deleteThumbQueue.pause();
  numberOfThumbsDeleted = 0;

  const crawler = new fdir()
    .withFullPaths()
    .filter((file: string) => {
      const  it: string = file.toLowerCase();
      return it.endsWith('.jpg') || it.endsWith('.mp4');
    })
    .crawl(directory);

  crawler.withPromise().then((files: string[]) => {

    files.forEach((file: string) => {
      const parsedPath = path.parse(file);
      const fileNameHash = parsedPath.name;

      if (!hashesPresent.has(fileNameHash)) {
        deleteThumbQueue.push(file);
        numberOfThumbsDeleted++;
      }
    });

    if (numberOfThumbsDeleted === 0) {
      GLOBALS.angularApp.sender.send('number-of-screenshots-deleted', 0);
    } else {
      deleteThumbQueue.resume(); // else only send message after the delete queue is finished
    }

  });

}

function deleteThumbQueueRunner(pathToFile: string, done): void {
  console.log('deleting:', pathToFile);

  fs.unlink(pathToFile, (err) => {
    done();
  });
}

/**
 * Prevent PC from going to sleep during screenshot extraction
 */
export function preventSleep(): void {
  console.log('preventing sleep');
  preventSleepIds.push(powerSaveBlocker.start('prevent-app-suspension'));
}

/**
 * Allow PC to go to sleep after screenshots were extracted
 */
function allowSleep(): void {
  console.log('allowing sleep');
  if (preventSleepIds.length) {
    preventSleepIds.forEach((id: number) => {
      powerSaveBlocker.stop(id);
    });
  }
  preventSleepIds = [];
}

function logPerformance(message: string, initial: number): void {
  console.log(message + Math.round((performance.now() - initial) / 100) / 10 + ' seconds.');
}
