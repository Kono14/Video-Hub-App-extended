import { Injectable } from '@angular/core';

import type { ImageElement } from '../../../../interfaces/final-object.interface';

import { givenNames } from './given-names';

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

// What release names put in front of the studio: `www 0xxx ws PixAndVideo 19 06 24 ...`, `( Site com ) ...`
const releasePrefix: Set<string> = new Set(['www', '0xxx', 'ws', 'com', 'net', 'org']);

// Where the title of a scene release ends: `... Behind Closed Doors XXX 2160p MP4-KTR`
const endOfTitle: Set<string> = new Set(['xxx', 'mp4', 'hevc', 'x264', 'x265', '4k', '480p', '540p', '720p', '1080p', '1440p', '2160p', '2880p']);

// First words of file names that say nothing about the video: `VID-2025-09-14`, `Clips Group 12`
const neverFallback: Set<string> = new Set(['vid', 'video', 'videos', 'img', 'clip', 'clips', 'full', 'new', 'part']);

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
 * The studio of a scene release: the first word before its date (`PixAndVideo 19 06 24 ...`, `ManyVids 2024 ...`),
 * once the release prefix (`www 0xxx ws`) is left out -- at most two words may stand before the date
 * @param cleanName
 * @returns in lower case, or `null`
 */
export function studioOf(cleanName: string): string | null {
  const release: SceneRelease | null = sceneRelease(cleanName);
  const studio: string = release ? release.studio : '';

  return /\p{L}/u.test(studio) && studio.length >= 3 && !neverInName.has(studio) && !neverFallback.has(studio) ? studio : null;
}

interface SceneRelease {
  studio: string;  // the first word before the date
  title: string[]; // the words between the date and `XXX`, the resolution or the like
}

/**
 * Split a scene release (`www 0xxx ws Studio 19 06 24 Title Words XXX 1080p MP4-KTR`) into studio and title
 * @param cleanName
 * @returns `null` if the name has no date close to its start
 */
function sceneRelease(cleanName: string): SceneRelease | null {
  const words: string[] = nameWords(cleanName);
  let start = 0;

  while (start < words.length && releasePrefix.has(words[start])) {
    start++;
  }

  const isDay = (w: string): boolean => /^\d{2}$/.test(w);
  const isYear = (w: string): boolean => /^(19|20)\d{2}$/.test(w);

  for (let i = start + 1; i <= start + 2 && i < words.length; i++) {
    const shortDate: boolean = isDay(words[i]) && isDay(words[i + 1] || '') && isDay(words[i + 2] || '');
    const longDate: boolean = isYear(words[i]) && isDay(words[i + 1] || '') && isDay(words[i + 2] || '');
    const yearOnly: boolean = isYear(words[i]) && start > 0; // a year alone counts only after a release prefix
    if (shortDate || longDate || yearOnly) {
      const titleStart: number = i + (yearOnly && !longDate ? 1 : 3);
      let titleEnd: number = titleStart;
      while (titleEnd < words.length && !endOfTitle.has(words[titleEnd])) {
        titleEnd++;
      }
      return { studio: words[start], title: words.slice(titleStart, titleEnd) };
    }
  }

  return null;
}

/**
 * Performers known by a first name only, in the title of a scene release: `YouthLust 2023 Selena Porn Audition`,
 * `18Lust 24 11 27 Finally Got To Fuck Kiara`, `18Lust 23 01 05 Annika And Scarlett Threesome`. Every given name in
 * the title counts; without one, the first word of the title does, as many studios start the title with the name
 * @param cleanName
 * @returns in lower case
 */
export function firstNamesInRelease(cleanName: string): string[] {
  const release: SceneRelease | null = sceneRelease(cleanName);
  if (!release) {
    return [];
  }

  const title: string[] = release.title.map((w: string) => w.replace(/'s$/, ''));
  const found: string[] = title.filter((w: string) => givenNames.has(w));
  if (found.length) {
    return Array.from(new Set(found));
  }

  const first: string = title[0];
  const usable: boolean = !!first && isNameWord(first) && first.length >= 3
                       && !neverInName.has(first) && !neverFirst.has(first) && !neverFallback.has(first);
  return usable ? [first] : [];
}

/**
 * A tag for a video without a recognised performer: what stands before the first ` - ` (a channel, a studio, or a
 * performer known by one name -- `katerealgirl - ...`), otherwise the first word of the name
 * @param cleanName
 * @returns in lower case, or `null`
 */
export function fallbackTag(cleanName: string): string | null {
  // a channel name may end in a few digits (`ladyannabelle666`), a camera's file name may not be a tag (`vid20261010`)
  const usable = (w: string): boolean => /^\p{L}[\p{L}']*\d{0,4}$/u.test(w) && w.length >= 3
                                      && !neverInName.has(w) && !neverFirst.has(w) && !neverFallback.has(w);

  const dash: number = cleanName.indexOf(' - ');
  if (dash > 0) {
    const before: string[] = nameWords(cleanName.slice(0, dash)).filter((w: string) => !releasePrefix.has(w));
    if (before.length >= 1 && before.length <= 3 && before.every(usable)) {
      return before.join(' ');
    }
  }

  const first: string = (nameWords(cleanName).find((w: string) => !releasePrefix.has(w)) || '').replace(/'s$/, '');
  return first && usable(first) ? first : null;
}

/**
 * The automatic tags of a video: its performers, its studio, and for a video without a recognised performer
 * the tag of `fallbackTag`. The title, the year, the resolution and the like are left out on purpose:
 * split into words they gave a video a dozen tags, and the video's details show year and resolution anyway
 * @param cleanName
 * @param knownNames -- from `learnArtistNames`
 */
export function automaticTags(cleanName: string, knownNames: Set<string>): string[] {
  const tags: string[] = artistNamesIn(cleanName, knownNames);

  if (!tags.length) {
    tags.push(...firstNamesInRelease(cleanName));
  }

  const studio: string | null = studioOf(cleanName);
  if (studio && !tags.includes(studio)) {
    tags.push(studio);
  }

  if (!tags.some((tag: string) => tag !== studio)) {
    const fallback: string | null = fallbackTag(cleanName);
    if (fallback && !tags.includes(fallback)) {
      tags.push(fallback);
    }
  }

  return tags;
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
 * The automatic tags of the videos of the open hub: names of performers (learnt from all file names) and studios
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

  /**
   * The automatic tags of a video -- see `automaticTags`
   * @param cleanName
   */
  tagsFor(cleanName: string): string[] {
    return automaticTags(cleanName, this.knownNames);
  }
}
