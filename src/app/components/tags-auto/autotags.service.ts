import { Injectable } from '@angular/core';

import { AutoTagsSaveService } from './tags-save.service';
import { ArtistNamesService } from './artist-names.service';

import type { ImageElement } from '../../../../interfaces/final-object.interface';

export interface WordAndFreq {
  word: string;
  freq: number;
  prefix: string; // filled in inside alphabetPrefixPipe
}

// Used to select words, allows for non-english characters
// thank you to https://stackoverflow.com/a/48902765/5017391
export const autoFileTagsRegex = /[\p{L}\d]+/ug;

@Injectable()
export class AutoTagsService {

  oneWordFreqMap: Map<string, number> = new Map(); // tags of one word: studios, channels, performers known by one name
  twoWordFreqMap: Map<string, number> = new Map(); // tags of more words: names of performers

  onlyFileNames: string[] = [];         // array with just clean file names toLowerCase

  minFiles = 2; // a tag is listed when at least this many videos have it

  cachedHub: string;

  constructor(
    public artistNamesService: ArtistNamesService,
    public autoTagsSaveService: AutoTagsSaveService
  ) { }

  /**
   * Count the automatic tags of all videos -- the same tags a single video shows (performers and studio),
   * not every word of the file names
   * @param finalArray - ImageElement[] of all files from app
   */
  public generateAllTags(finalArray: ImageElement[], hubName: string): Promise<boolean> {

    if (this.cachedHub !== hubName) {

      this.resetState();

      this.cachedHub = hubName;

      this.storeFinalArrayInMemory(finalArray);

      this.trimMap(this.oneWordFreqMap, this.minFiles);
      this.trimMap(this.twoWordFreqMap, this.minFiles);

      this.loadAddTags();
      this.loadRemoveTags();
    }

    return Promise.resolve(true);
  }

  /**
   * Reset all variables so we can recalculate things for the new hub
   */
  private resetState(): void {
    this.oneWordFreqMap = new Map();
    this.twoWordFreqMap = new Map();
    this.onlyFileNames = [];
  }

  /**
   * Generate `onlyFileNames` which is string[] of just file names in lower case,
   * and count how many videos have each automatic tag
   * @param finalArray - the whole initial ImageElement[]
   */
  private storeFinalArrayInMemory(finalArray: ImageElement[]): void {
    finalArray.forEach((element) => {
      if (element.cleanName === '*FOLDER*') {
        return;
      }

      this.onlyFileNames.push((element.cleanName.toLowerCase().match(autoFileTagsRegex) || []).join(' '));

      this.artistNamesService.tagsFor(element.cleanName, !!(element.tags && element.tags.length)).forEach((tag: string) => {
        const map: Map<string, number> = tag.includes(' ') ? this.twoWordFreqMap : this.oneWordFreqMap;
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
  }

  /**
   * Convert a Map<string, number> to WordAndFreq[] containing objects { word: string, freq: number }
   * @param someMap
   * @param minCutoff -- minimum number of elements a tag must have before it is returned
   */
  private convertMapToWordAndFreqArray(someMap: Map<string, number>): WordAndFreq[] {
    const returnArray: WordAndFreq[] = [];

    someMap.forEach((val: number, key: string) => {
      returnArray.push({
        word: key,
        freq: val,
        prefix: undefined, // to be filled in by alphabetPrefixPipe
      });
    });

    return returnArray;
  }

  /**
   * Return alphabetized the one-word tags with their frequencies
   */
  public getOneWordTags(): WordAndFreq[] {
    return this.alphabetizeResults(this.convertMapToWordAndFreqArray(this.oneWordFreqMap));
  }

  /**
   * Return alphabetized the two-word tags with their freqeuencies
   */
  public getTwoWordTags(): WordAndFreq[] {
    return this.alphabetizeResults(this.convertMapToWordAndFreqArray(this.twoWordFreqMap));
  }

  /**
   * Trim a given map to only have elements with `minCutoff` instances
   * @param givenMap
   * @param minCutoff
   */
  private trimMap(givenMap: Map<string, number>, minCutoff: number): void {
    givenMap.forEach((val: number, key: string) => {
      if (val < minCutoff) {
        givenMap.delete(key);
      }
    });
  }

  /**
   * Alphabetize any WordAndFreq[]
   * @param wordAndFreq
   */
  private alphabetizeResults(wordAndFreq: WordAndFreq[]): WordAndFreq[] {
    wordAndFreq.sort((x: any, y: any) => {
      const first = x.word;
      const second = y.word;

      if (first < second) {
        return -1;
      } else {
        return 1;
      }
    });

    return wordAndFreq;
  }

  /**
   * Decide how many files contain current query
   * used by tag-match.pipe and tags.component
   * @param query
   */
  public findMatches(query: string): number {
    return this.onlyFileNames.filter((element) => {
      return element.toLowerCase().includes(query.toLowerCase());
    }).length;
  }

  /**
   * Attempt to add tag to the list
   * @param tag
   */
  public canWeAdd(tag: string): boolean {
    if (tag.includes(' ')) {
      if (this.twoWordFreqMap.has(tag)) {
        return false;
      } else {
        this.twoWordFreqMap.set(tag, this.findMatches(tag));
        return true;
      }
    } else {
      if (this.oneWordFreqMap.has(tag)) {
        return false;
      } else {
        this.oneWordFreqMap.set(tag, this.findMatches(tag));
        return true;
      }
    }
  }

  /**
   * Add to the map all tags present in the `addTags` array
   * from the `autoTagsSaveService`
   */
  private loadAddTags(): void {
    const allAddTags = this.autoTagsSaveService.getAddTags();

    allAddTags.forEach((tag) => {
      if (tag.includes(' ')) {
        this.twoWordFreqMap.set(tag, this.findMatches(tag));
      } else {
        this.oneWordFreqMap.set(tag, this.findMatches(tag));
      }
    });

  }

  /**
   * Remove from map any tags present in the `removeTags` array
   * from the `autoTagsSaveService`
   */
  private loadRemoveTags(): void {
    const allRemoveTags = this.autoTagsSaveService.getRemoveTags();

    allRemoveTags.forEach((tag) => {
      if (tag.includes(' ')) {
        this.twoWordFreqMap.delete(tag);
      } else {
        this.oneWordFreqMap.delete(tag);
      }
    });

  }


  /**
   * Remove a tag from the map
   * @param tag
   */
  public removeTag(tag: string): void {
    if (tag.includes(' ')) {
      this.twoWordFreqMap.delete(tag);
    } else {
      this.oneWordFreqMap.delete(tag);
    }
  }

}
