import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import { ArtistNamesService } from './artist-names.service';
import { ManualTagsService } from '../tags-manual/manual-tags.service';

import { Colors } from '../../common/colors';
import type { ImageElement } from '../../../../interfaces/final-object.interface';
import type { Tag } from '../../../../interfaces/shared-interfaces';

@Pipe({
  standalone: false,
  name: 'tagDisplayPipe'
})
export class TagsDisplayPipe implements PipeTransform {

  constructor(
    private artistNamesService: ArtistNamesService,
    private manualTagsService: ManualTagsService
  ) { }

  transform(
    video: ImageElement,
    manualTags: boolean,
    autoFileTags: boolean,
    autoFolderTags: boolean,
    updateViewHack: boolean | number
  ): Tag[] {

    const tags: Tag[] = [];

    const alreadyAdded = new Set();

    if (manualTags) {
      if (video.tags) {
        video.tags.sort().forEach(tag => {
          tags.push({
            name: tag,
            colour: this.manualTagsService.getTagColor(tag) || Colors.manualTags,
            removable: true
          });
          alreadyAdded.add(tag.toLowerCase()); // automatic tags are in lower case -- `Selena` and `selena` are one
        });
      }
    }

    if (autoFileTags) {
      // performers and studio only -- not every word of the title, year, resolution and the like
      this.artistNamesService.tagsFor(video.cleanName, !!(video.tags && video.tags.length)).forEach((tag: string) => {
        if (!alreadyAdded.has(tag)) {
          tags.push({
            name: tag,
            colour: Colors.autoFileTags,
            removable: false
          });
          alreadyAdded.add(tag);
        }
      });
    }

    if (autoFolderTags) {
      const cleanedFileName: string = video.partialPath.toLowerCase().replace('.', '');
      cleanedFileName.split('/').forEach(word => {
        if (word.length >= 3 && !alreadyAdded.has(word)) { // TODO - fix hardcoding ?
          tags.push({
            name: word,
            colour: Colors.autoFolderTags,
            removable: false
          });
          alreadyAdded.add(word);
        }
      });
    }

    return tags;
  }
}
