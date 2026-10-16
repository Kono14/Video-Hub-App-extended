import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

import { autoFileTagsRegex } from './autotags.service';
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
    updateViewHack: boolean
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
          alreadyAdded.add(tag);
        });
      }
    }

    if (autoFileTags) {
      // the name of a performer as a whole, before its single words
      this.artistNamesService.namesIn(video.cleanName).forEach((name: string) => {
        if (!alreadyAdded.has(name)) {
          tags.push({
            name: name,
            colour: Colors.autoFileTags,
            removable: false
          });
          alreadyAdded.add(name);
        }
      });

      const cleanedFileNameAsArray: string[] = video.cleanName.toLowerCase().match(autoFileTagsRegex) || [];
      cleanedFileNameAsArray.forEach(word => {
        if (word.length >= 3 && !alreadyAdded.has(word)) { // TODO - fix hardcoding ?
          tags.push({
            name: word,
            colour: Colors.autoFileTags,
            removable: false
          });
          alreadyAdded.add(word);
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
