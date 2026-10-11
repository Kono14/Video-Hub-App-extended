import { Component, input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-donut',
  templateUrl: './donut.component.html',
  styleUrls: ['./donut.component.scss']
})
export class DonutComponent {

  readonly darkMode = input<boolean>();
  readonly left = input<number>();      // how many videos are still to be done
  readonly leftLabel = input<string>(); // the word to follow that number
  readonly percent = input<number>();
  readonly perMinute = input<number>(); // 0 == not known yet
  readonly timeLeft = input<string>();  // how long it still takes and when it ends; empty == not known yet

  constructor() { }

}
