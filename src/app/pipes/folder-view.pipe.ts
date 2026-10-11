import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import type { ImageElement, StarRating} from '../../../interfaces/final-object.interface';
import { NewImageElement } from '../../../interfaces/final-object.interface';
import type { SettingsButtonsType} from '../common/settings-buttons';
import { SettingsButtons } from '../common/settings-buttons';

interface FolderProperties {
  birthtime: number;       //                 corresponds to ImageElement `birthtime`
  byteSize: number;        //                 corresponds to ImageElement `fileSize`
  duration: number;        // in seconds,     corresponds to ImageElement `duration`
  lastPlayed: number       //                 corresponds to ImageElement `lastPlayed`
  mtime: number;           //                 corresponds to ImageElement `mtime`
  starAverage: StarRating; // averaged weight of stars rounded to nearest `StarRating`
  timesPlayed: number      //                 corresponds to ImageElement `timesPlayed`
  uuid: string             // so that @for can `track` uniquely
}


@Pipe({
  standalone: false,
  name: 'folderViewPipe'
})
export class FolderViewPipe implements PipeTransform {

  settingsButtons: SettingsButtonsType = SettingsButtons;
  /**
   * Determine folder size, duration, and average star rating (simply sum up / average the relevant ImageElement properties)
   * @param files
   */
  determineFolderProperties(files: ImageElement[]): FolderProperties {
    let firstCreated: number = Number.MAX_SAFE_INTEGER;
    let lastPlayed = 0;
    let lastUpdated = 0;
    let starAverage = 0;
    let timesPlayed = 0;
    let totalDuration = 0;
    let totalFileSize = 0;
    let totalStars = 0;

    // unsure if `folder` is needed here, but just in case to prevent uuid collision
    const uuid = 'folder' + files[0].uuid;

    files.forEach((element: ImageElement) => {
      totalFileSize += element.fileSize;
      totalDuration += element.duration;
      if (element.timesPlayed > timesPlayed) {
        timesPlayed = element.timesPlayed;
      }
      if (element.lastPlayed > lastPlayed) {
        lastPlayed = element.lastPlayed;
      }
      if (element.mtime > lastUpdated) {
        lastUpdated = element.mtime;
      }
      if (element.birthtime < firstCreated) {
        firstCreated = element.birthtime;
      }
      if (element.stars !== 0.5) {
        totalStars += 1;
        starAverage += element.stars;
      }
    });

    const starString: StarRating = <StarRating><unknown>((Math.round(starAverage / totalStars - 0.5) + 0.5) || 0.5).toString();
    //                         since `totalStars` can be 0, sometimes this calculation results in NaN so we ^^^^^^^

    return {
      birthtime: firstCreated,
      byteSize: totalFileSize,
      duration: totalDuration,
      lastPlayed: lastPlayed,
      mtime: lastUpdated,
      starAverage: starString,
      timesPlayed: timesPlayed,
      uuid: uuid,
    };
  }

  /**
   * Takes ImageElement array and returns 4 videos (or `numOfPreviews` if given)
   * so the folderView has something to show!
   * @param files
   * @param numOfPreviews
   * @param fillRow       `numOfPreviews` is the width of a row, counted in 16:9 screenshots: return enough videos to
   *                      fill it -- a video of a narrower shape takes up less of the row, so there may be more of them
   */
  extractFourPreviews(files: ImageElement[], numOfPreviews: number = 4, fillRow: boolean = false): ImageElement[] {
    const random: boolean = files.length > numOfPreviews && this.settingsButtons['randomizeFoldersScreenshots'].toggled;
    const pool: ImageElement[] = random ? [...files] : []; // to draw from, so that no video is picked twice
    const previews: ImageElement[] = [];
    let spaceLeft: number = numOfPreviews;

    while (spaceLeft > 0 && previews.length < files.length && previews.length < numOfPreviews * 4) {
      const next: ImageElement = random
        ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
        : files[previews.length];

      previews.push(next);
      spaceLeft -= fillRow ? this.widthInRow(next) : 1;
    }

    return previews;
  }

  /**
   * How much room the screenshot of a video takes up in a row, compared to a 16:9 screenshot
   * @param video
   */
  widthInRow(video: ImageElement): number {
    const shape: number = video.width / video.height;

    return (shape > 0 && shape < 16 / 9) ? shape / (16 / 9) : 1;
  }


  /**
   * Serves TWO important purposes:
   *  (1) to group all the videos in subdirectory into a folder - displaying 1 element in gallery
   *  (2) to allow user to navigate to a particular subfolder by clicking on it
   *      - must allow for an `UP` folder as well - to navigate backwards !!!
   *
   * The process has 6 steps:
   *  (1) create a subCopy (only elements that are within `prefixPath`)
   *  (2) create a Map (from first subfolder to every element within the subfolder)
   *  (3) create a new ImageElement[] to return back (empty at this stage)
   *  (4) insert `UP` folder if `prefixPath` exists
   *  (5) convert the Map into ImageElements to display (filling array from step 3)
   *  (6) return the newly-created ImageElement[]
   *
   * @param finalArray
   * @param render      whether to insert folders
   * @param prefixPath  current folder in view (full path to CWD - "current working directory")
   * @param numOfPreviews how many videos of a folder to show a screenshot of (the filmstrip view needs more than 4)
   * @param fillRow     whether `numOfPreviews` is the width of a row to fill, rather than a number of videos
   */
  transform(
    finalArray: ImageElement[], render: boolean, prefixPath?: string, numOfPreviews: number = 4, fillRow: boolean = false
  ): ImageElement[] {

    if (render) {

      // Step 1: select subset of elments - only those within `prefixPath`
      let subCopy: ImageElement[] = [];

      if (prefixPath) {
        subCopy = finalArray.filter((element) => {
          return (
               element.partialPath === (prefixPath)               // needs to be exact
            || element.partialPath.startsWith(prefixPath + '/')   // or starts with exactly
          );
        });

      } else {
        subCopy = finalArray;
      }

      // Step 2: create a map from first subfolder within `prefixPath` to each element inside that subfolder
      const pathToElementsMap: Map<string, ImageElement[]> = new Map();
      // looks like:
      //   "" => Array(3)           <-- means 3 files in CWD
      //   "Folder1" => Array(25)   <-- means 25 files in subfolder named "Folder1"
      //   "Folder2" => Array(7)    <-- etc

      // Note we are always working with `.partialPath` which is always a folder path, never file name
      subCopy.forEach((element) => {

        let keyForMap: string;
        // can either be one of two:
        // (1) "" => points to array of elements directly inside "CWD"
        // (2) folder name => only folder immediately inside the "CWD" (Current Working Directory)

        if (prefixPath) {
          //   `remainingPath` is what is remaining after `prefixPath` has been removed
          const remainingPath: string = element.partialPath.replace(prefixPath, '');

          // If it includes `/` it means it is an element inside a sub-folder
          // we store it in the key for the bottom-most folder in "CWD"
          if (remainingPath.substring(1).includes('/')) {
            //             ^^^^^^^^^^^^^ make sure to remove the first character -- it is always `/`

            // first element may be nested, e.g. `/a/b/c`
            // if `prefixPath` is `a` the first folder should be `/b` not `/b/c`
            keyForMap = '/' + remainingPath.split('/')[1];

          } else {
            keyForMap = remainingPath;
          }

        } else {
          // only grab the first subfolder
          // e.g.
          //    abc         => abc
          //    abc/def     => abc
          //    abc/def/xyz => abc
          keyForMap = element.partialPath.split('/')[1] || '';
          // first element [0] always empty element ^^^ so we grab the second:
          // ("/abc").split('/') ==> ['', 'abc']
        }

        if (pathToElementsMap.has(keyForMap)) {
          pathToElementsMap.get(keyForMap).push(element); // not a copy with the element added -- that is quadratic
        } else {
          pathToElementsMap.set(keyForMap, [element]);
        }
      });

      // Step 3: create a new array to return filled with folders as ImageElements
      const arrWithFolders: ImageElement[] = [];

      // Step 4: append the UP folder if we're inside any folder
      if (prefixPath.length) {
        const upButton: ImageElement = NewImageElement();

        upButton.cleanName   = '*FOLDER*';
        upButton.fileName    = '*UP*';
        upButton.partialPath = prefixPath.substring(0, prefixPath.lastIndexOf('/')),

        arrWithFolders.push(upButton);
      }

      // Step 5: convert the Map into ImageElements to display
      pathToElementsMap.forEach((value: ImageElement[], key: string) => {

        if (key === '') {
          arrWithFolders.push(...value); // spread out all files in current (root or `prefixPath`) folder
        } else {

          const folderProperties: FolderProperties = this.determineFolderProperties(value);

          const previews: ImageElement[] = this.extractFourPreviews(value, numOfPreviews, fillRow);

          const folderWithStuff: ImageElement = NewImageElement();

          folderWithStuff.birthtime       = folderProperties.birthtime;
          folderWithStuff.cleanName       = '*FOLDER*';
          folderWithStuff.duration        = folderProperties.duration;
          folderWithStuff.fileName        = key.replace('/', '');
          folderWithStuff.fileSize        = folderProperties.byteSize;
          folderWithStuff.fileSizeDisplay = value.length.toString(), // indicates the number of files in the folder!
          folderWithStuff.folderPreviews  = previews;
          folderWithStuff.hash            = previews.map((video: ImageElement) => video.hash).join(':');
          folderWithStuff.index           = -1, // always show at the top (but after the `UP` folder) in the default view
          folderWithStuff.lastPlayed      = folderProperties.lastPlayed;
          folderWithStuff.mtime           = folderProperties.mtime;
          folderWithStuff.partialPath     = (prefixPath || '/') + key, // must set this for the folder click to register!
          folderWithStuff.stars           = folderProperties.starAverage;
          folderWithStuff.timesPlayed     = folderProperties.timesPlayed;
          folderWithStuff.uuid            = folderProperties.uuid;

          arrWithFolders.push(folderWithStuff);
        }

      });

      // Step 6: return
      return arrWithFolders;

    } else {
      return finalArray;
    }
  }

}
