import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CardId, Mats } from 'shared/shared-types';

@Component({
  selector: 'app-mat-zone',
  imports: [],
  templateUrl: './mat-zone.component.html',
  styleUrl: './mat-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatZoneComponent implements AfterViewInit {
  @Input() mat!: { mat: Mats; cardIds: CardId[] };

  @ViewChild('matTab') matTab!: ElementRef;
  @Output() openMat = new EventEmitter<{ mat: Mats; cardIds: CardId[] }>();

  ngAfterViewInit(): void {

  }
}
