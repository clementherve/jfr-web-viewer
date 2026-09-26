import { Component, ElementRef, ViewChild, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div
      class="dropzone"
      role="button"
      tabindex="0"
      aria-label="Choose a .jfr file, or drop one here"
      [class.active]="dragActive()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="openPicker()"
      (keydown.enter)="openPicker()"
      (keydown.space)="openPicker(); $event.preventDefault()"
    >
      <mat-icon class="dropzone-icon" aria-hidden="true">{{ dragActive() ? 'download' : 'upload_file' }}</mat-icon>
      <p class="dropzone-title">{{ dragActive() ? 'Release to open' : 'Drop a .jfr file here' }}</p>
      <button mat-flat-button type="button" tabindex="-1" (click)="openPicker(); $event.stopPropagation()">Choose file</button>
    </div>
    <input #fileInput type="file" accept=".jfr" hidden (change)="onFileInputChange($event)" />
  `,
  styles: [
    `
      .dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 280px;
        padding: 32px 24px;
        box-sizing: border-box;
        background: var(--panel);
        border: 1.5px dashed color-mix(in srgb, var(--muted) 45%, transparent);
        border-radius: 14px;
        cursor: pointer;
        text-align: center;
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease;
      }
      .dropzone:hover {
        border-color: var(--signal);
      }
      .dropzone.active {
        border-style: solid;
        border-color: var(--signal);
        background-color: var(--signal-wash);
      }
      .dropzone-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: var(--signal);
      }
      .dropzone-title {
        font-size: 18px;
        font-weight: 500;
        margin: 0 0 4px;
      }
    `,
  ],
})
export class UploadComponent {
  fileSelected = output<File>();
  protected dragActive = signal(false);
  /** dragenter/dragleave fire for every child element; count them to know when the pointer really leaves. */
  private dragDepth = 0;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected openPicker(): void {
    this.fileInput.nativeElement.click();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth++;
    this.dragActive.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.fileSelected.emit(file);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileSelected.emit(file);
    input.value = '';
  }
}
