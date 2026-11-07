import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import type { ImageElement } from '../../../interfaces/final-object.interface';

import { splitOrTerms } from '../common/or-search';

@Pipe({
  standalone: false,
  name: 'startsWithSearchPipe',
})
export class StartsWithSearchPipe implements PipeTransform {

  /**
   * Return only items that names start with search string
   * @param finalArray
   * @param searchString  the search string
   */
  transform(finalArray: ImageElement[], searchString?: string): ImageElement[] {
    if (searchString.length > 0) {
      // `a OR b` finds the videos with a word that starts with a or b
      const starts: string[] = splitOrTerms(searchString).map((start: string) => start.toLowerCase());
      return finalArray.filter((item) =>
        item.cleanName.split(' ').find((word) => starts.some((start: string) => word.toLowerCase().startsWith(start)))
      );
    } else {
      return finalArray;
    }
  }
}
