import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import type { ImageElement } from '../../../interfaces/final-object.interface';

import { splitOrTerms } from '../common/or-search';

@Pipe({
  standalone: false,
  name: 'magicSearchPipe'
})
export class MagicSearchPipe implements PipeTransform {

  /**
   * Return only items that match search string
   * @param finalArray
   * @param searchString  the search string
   */
  transform(finalArray: ImageElement[], searchString?: string): ImageElement[] {
    if (searchString === '') {
      return finalArray;
    } else {
      // `a OR b` finds the videos that match a or b
      const words: string[] = splitOrTerms(searchString).map((word: string) => word.toLowerCase());
      return finalArray.filter(item => {
        const partialPath: string = item.partialPath.toLowerCase();
        const fileName: string = item.fileName.toLowerCase();
        const tags: string = item.tags ? item.tags.join().toLowerCase() : '';
        return words.some((word: string) =>
          partialPath.indexOf(word) !== -1 || fileName.indexOf(word) !== -1 || tags.indexOf(word) !== -1
        );
      });
    }
  }
}
