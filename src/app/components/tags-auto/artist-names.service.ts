import { Injectable } from '@angular/core';

import type { ImageElement } from '../../../../interfaces/final-object.interface';

// Every word of a name, in lower case: letters (of any language) and apostrophes
const nameWordRegex = /[\p{L}\d']+/gu;
const isNameWord = (word: string): boolean => /^\p{L}[\p{L}']+$/u.test(word);

// Words that are never part of a name -- what follows a performer known by one name only, or joins two of them
const neverInName: Set<string> = new Set([
  'and', 'vs', 'with', 'feat', 'featuring', 'ft', 'is', 'are', 'was', 'got',
  'xxx', 'porn', 'sex', 'cum', 'anal', 'fuck', 'fucked', 'gangbang', 'joi', 'cei', 'pov', 'haul', 'hd', 'uhd', 'fhd', 'vr',
]);
const neverFirst: Set<string> = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'its', 'finally', 'best']);
const neverLast: Set<string> = new Set(['de', 'del', 'della', 'da', 'di', 'la', 'le', 'van', 'von', 'of', 'in', 'on']);

/**
 * Whether the words could be the name of a performer
 * @param words -- in lower case
 */
function couldBeName(words: string[]): boolean {
  return words.every((word: string) => isNameWord(word) && !neverInName.has(word))
      && !neverFirst.has(words[0])
      && !neverLast.has(words[words.length - 1]);
}

/**
 * The words of a file name in lower case, as the automatic tags have them
 * @param cleanName
 */
function nameWords(cleanName: string): string[] {
  return cleanName.toLowerCase().match(nameWordRegex) || [];
}

/**
 * The performer a file name names where performers are usually named:
 *  - a scene release names them right after the date: `Site 19 06 24 Angelika Grays Title XXX 2160p` -- the two words after it
 *  - many others put them first: `Goddess Maven May - Title` -- what stands before the first ` - `, if two or three words
 * @param cleanName
 * @returns the names found, in lower case, words joined by a space
 */
export function artistNamesByPosition(cleanName: string): string[] {
  const names: string[] = [];

  const afterDate: RegExpExecArray = /(?:^|\s)\d{2}\s\d{2}\s\d{2}\s(.*)$/u.exec(cleanName);
  if (afterDate) {
    const words: string[] = nameWords(afterDate[1]).slice(0, 2);
    if (words.length === 2 && couldBeName(words)) {
      names.push(words.join(' '));
    }
  }

  const dash: number = cleanName.indexOf(' - ');
  if (dash > 0) {
    const words: string[] = nameWords(cleanName.slice(0, dash));
    if (words.length >= 2 && words.length <= 3 && couldBeName(words)) {
      names.push(words.join(' '));
    }
  }

  return names;
}

/**
 * The names of performers in a file name: those at the usual places (see `artistNamesByPosition`),
 * and any name found that way in another file of the hub, wherever it stands --
 * so in `Mary Moody And Molly Stewart` the second name is found too
 * @param cleanName
 * @param knownNames -- from `learnArtistNames`
 */
export function artistNamesIn(cleanName: string, knownNames: Set<string>): string[] {
  const names: Set<string> = new Set(artistNamesByPosition(cleanName));
  const words: string[] = nameWords(cleanName);

  for (let i = 0; i < words.length - 1; i++) {
    const two: string = words[i] + ' ' + words[i + 1];
    if (knownNames.has(two)) {
      names.add(two);
    }
    if (i < words.length - 2 && knownNames.has(two + ' ' + words[i + 2])) {
      names.add(two + ' ' + words[i + 2]);
    }
  }

  return Array.from(names);
}

/**
 * Every name found at the usual places in the file names of a hub
 * @param cleanNames
 */
export function learnArtistNames(cleanNames: string[]): Set<string> {
  const names: Set<string> = new Set();
  cleanNames.forEach((cleanName: string) => {
    artistNamesByPosition(cleanName).forEach((name: string) => names.add(name));
  });
  return names;
}

/**
 * The names of performers that the file names of the open hub have -- for the automatic tags,
 * which otherwise only have the single words of a name
 */
@Injectable({
  providedIn: 'root'
})
export class ArtistNamesService {

  knownNames: Set<string> = new Set();

  /**
   * Learn the names from the file names of a hub
   * @param videos
   */
  learn(videos: ImageElement[]): void {
    this.knownNames = learnArtistNames(
      videos.filter((video: ImageElement) => video.cleanName !== '*FOLDER*').map((video: ImageElement) => video.cleanName)
    );
  }

  /**
   * The names of performers in the name of a video
   * @param cleanName
   */
  namesIn(cleanName: string): string[] {
    return artistNamesIn(cleanName, this.knownNames);
  }
}
