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
      [class.active]="dragActive()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
    >
      <mat-icon class="dropzone-icon">upload_file</mat-icon>
      <p class="dropzone-title">Drop a .jfr file here</p>
      <p class="dropzone-subtitle">or click to browse&mdash;parsing happens entirely in your browser, nothing is uploaded anywhere.</p>
      <button mat-flat-button type="button" (click)="fileInput.click(); $event.stopPropagation()">Choose file</button>
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
        gap: 8px;
        padding: 48px 24px;
        border: 2px dashed var(--mat-sys-outline);
        border-radius: 16px;
        cursor: pointer;
        text-align: center;
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease;
      }
      .dropzone.active {
        border-color: var(--mat-sys-primary);
        background-color: var(--mat-sys-primary-container);
      }
      .dropzone-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-primary);
      }
      .dropzone-title {
        font-size: 18px;
        font-weight: 500;
        margin: 4px 0;
      }
      .dropzone-subtitle {
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 12px;
        max-width: 420px;
      }
    `,
  ],
})
export class UploadComponent {
  fileSelected = output<File>();
  protected dragActive = signal(false);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
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
