import type { OnInit, ElementRef} from '@angular/core';
import { Component, computed, input, output, viewChild } from '@angular/core';

import { FilePathService } from '../file-path.service';

import { metaAppear, textAppear } from '../../../common/animations';

import type { ImageElement } from '../../../../../interfaces/final-object.interface';
import { ImageElementService } from './../../../services/image-element.service';
import type { RightClickEmit, VideoClickEmit } from '../../../../../interfaces/shared-interfaces';

interface FolderFrame {
  path: string;  // to the thumbnail of a video in the folder
  width: number; // in pixels
}

@Component({
  standalone: false,
  selector: 'app-filmstrip-item',
  templateUrl: './filmstrip.component.html',
  styleUrls: [
      '../film-and-full.scss',
      '../time-and-rez.scss',
      '../selected.scss',
      './filmstrip.component.scss'
    ],
  animations: [ textAppear, metaAppear ]
})
export class FilmstripComponent implements OnInit {

  readonly filmstripHolder = viewChild<ElementRef>('filmstripHolder');

  readonly videoClick = output<VideoClickEmit>();
  readonly rightClick = output<RightClickEmit>();

  readonly video = input<ImageElement>();

  readonly compactView = input<boolean>();
  readonly darkMode = input<boolean>();
  readonly elHeight = input<number>();
  readonly folderPath = input<string>();
  readonly hoverScrub = input<boolean>();
  readonly hubName = input<string>();
  readonly imgHeight = input<number>();
  readonly largerFont = input<boolean>();
  readonly showMeta = input<boolean>();
  readonly showFavorites = input<boolean>();

  // a folder carries some of its videos: one screenshot of each is shown, as wide as the picture in it
  readonly folderFrames = computed<FolderFrame[]>(() => {
    return (this.video().folderPreviews || []).map((video: ImageElement) => {
      return {
        path: this.filePathService.createFilePath(this.folderPath(), this.hubName(), 'thumbnails', video.hash),
        width: this.pictureWidth(video) || this.imgHeight() * (16 / 9)
      };
    });
  });

  // the video the filmstrip belongs to: a folder with a single video inside shows the filmstrip of that video
  readonly filmstripVideo = computed<ImageElement>(() => {
    const folderPreviews: ImageElement[] = this.video().folderPreviews;

    return (folderPreviews && folderPreviews.length === 1) ? folderPreviews[0] : this.video();
  });

  // Every screenshot of a filmstrip sits in a 16:9 cell: a video of a narrower shape (filmed upright, or 4:3) has
  // black bars left and right of each of them. For such a video this is the width of the picture inside a cell,
  // so that the screenshots can be shown side by side without the bars -- 0 for a video that fills its cells
  readonly frameWidth = computed<number>(() => this.pictureWidth(this.filmstripVideo()));

  // where the picture of each screenshot starts inside the filmstrip image
  readonly frameOffsets = computed<number[]>(() => {
    const cellWidth = this.imgHeight() * (16 / 9);
    const barWidth = (cellWidth - this.frameWidth()) / 2;

    return Array.from({ length: this.filmstripVideo().screens }, (_, index) => index * cellWidth + barWidth);
  });

  fullFilePath = '';
  filmXoffset = 0;
  indexToShow = 1;

  constructor(
    public filePathService: FilePathService,
    public imageElementService: ImageElementService
  ) { }

  ngOnInit() {
    this.fullFilePath = this.filePathService.createFilePath(this.folderPath(), this.hubName(), 'filmstrips', this.video().hash);
  }

  /**
   * The width of the picture inside a screenshot of the video -- 0 if the picture fills the 16:9 cell
   * @param video
   */
  pictureWidth(video: ImageElement): number {
    const cellWidth = this.imgHeight() * (16 / 9);
    const pictureWidth = Math.floor(this.imgHeight() * video.width / video.height) - 2; // the edge of a bar is not sharp

    return (video.width > 0 && video.height > 0 && pictureWidth > 0 && pictureWidth < cellWidth - 4) ? pictureWidth : 0;
  }

  updateFilmXoffset(mouseMove: PointerEvent) {
    if (this.hoverScrub() && this.frameWidth()) {
      const holder: DOMRect = this.filmstripHolder().nativeElement.getBoundingClientRect();
      const cursorX = mouseMove.clientX - holder.left; // `layerX` would be relative to the screenshot under the cursor
      const lastScreen = this.video().screens - 1;
      const screensOutsideCutoff = Math.max(0, this.video().screens - Math.floor(holder.width / this.frameWidth()));
      const firstScreenShown = Math.min(screensOutsideCutoff, Math.floor(cursorX / holder.width * (screensOutsideCutoff + 1)));

      this.indexToShow = Math.max(0, Math.min(lastScreen, firstScreenShown + Math.floor(cursorX / this.frameWidth())));
      this.filmXoffset = this.frameWidth() * firstScreenShown;
    } else if (this.hoverScrub()) {
      const imgWidth = this.imgHeight() * (16 / 9); // hardcoded aspect ratio
      const containerWidth = this.filmstripHolder().nativeElement.getBoundingClientRect().width;
      const howManyScreensOutsideCutoff = this.video().screens - Math.floor(containerWidth / imgWidth);

      const cursorX = mouseMove.layerX; // cursor's X position inside the filmstrip element
      this.indexToShow = Math.floor(cursorX * (this.video().screens / containerWidth));
      this.filmXoffset = imgWidth * Math.floor(cursorX / (containerWidth / howManyScreensOutsideCutoff));
    }
  }

  toggleHeart(mouseClick: PointerEvent): void {
    mouseClick.stopPropagation();
    this.imageElementService.toggleHeart(this.video().index);
  }
}
