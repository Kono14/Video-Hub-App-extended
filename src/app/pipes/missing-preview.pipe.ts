import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import type { ImageElement } from '../../../interfaces/final-object.interface';

@Pipe({
  standalone: false,
  name: 'missingPreviewPipe'
})
export class MissingPreviewPipe implements PipeTransform {

  /**
   * If `onlyMissing` return only the videos that lack a thumbnail or a filmstrip
   * @param finalArray
   * @param onlyMissing       {boolean}
   * @param existingPreviews  hashes that have both files on disk; `null` until node has answered
   */
  transform(finalArray: ImageElement[], onlyMissing: boolean, existingPreviews: Set<string>): ImageElement[] {

    if (onlyMissing && existingPreviews) {
      return finalArray.filter(element => !existingPreviews.has(element.hash));
    } else {
      return finalArray;
    }

  }

}
