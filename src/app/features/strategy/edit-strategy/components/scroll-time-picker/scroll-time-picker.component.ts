import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Time picker with scrollable columns (hours, minutes, AM/PM) and typeable input.
 * Matches project styling (dark theme, green accent).
 */
@Component({
  selector: 'app-scroll-time-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scroll-time-picker.component.html',
  styleUrl: './scroll-time-picker.component.scss',
})
export class ScrollTimePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() placeholder = '--:--';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('hoursScroll') hoursScroll!: ElementRef<HTMLDivElement>;
  @ViewChild('minutesScroll') minutesScroll!: ElementRef<HTMLDivElement>;

  isOpen = false;
  hour = 12;
  minute = 0;
  period: 'AM' | 'PM' = 'AM';

  hours = Array.from({ length: 12 }, (_, i) => i + 1);
  minutes = Array.from({ length: 60 }, (_, i) => i);
  periods: ('AM' | 'PM')[] = ['AM', 'PM'];

  private get formattedValue(): string {
    const h = this.hour;
    const m = this.minute;
    const p = this.period;
    return `${h}:${m.toString().padStart(2, '0')} ${p}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && this.elRef.nativeElement && !this.elRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  constructor(private elRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      this.parseValue(this.value);
    } else if (changes['value'] && !this.value) {
      this.hour = 12;
      this.minute = 0;
      this.period = 'AM';
    }
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.parseValue(this.value);
      setTimeout(() => this.scrollToSelected(), 50);
    }
  }

  close(): void {
    this.isOpen = false;
  }

  onInputChange(_raw: string): void {
    // No formatear en tiempo real; solo al salir del input (onInputBlur)
  }

  onInputBlur(): void {
    const raw = (this.inputRef?.nativeElement?.value ?? this.value ?? '').toString().trim();
    const parsed = this.parseInput(raw);
    if (parsed) {
      this.hour = parsed.hour;
      this.minute = parsed.minute;
      this.period = parsed.period;
      this.valueChange.emit(this.formattedValue);
    } else if (this.value) {
      this.parseValue(this.value);
      this.valueChange.emit(this.formattedValue);
    }
  }

  selectHour(h: number): void {
    this.hour = h;
    this.emit();
  }

  selectMinute(m: number): void {
    this.minute = m;
    this.emit();
  }

  selectPeriod(p: 'AM' | 'PM'): void {
    this.period = p;
    this.emit();
  }

  private emit(): void {
    this.valueChange.emit(this.formattedValue);
  }

  private parseValue(v: string): void {
    if (!v || !v.trim()) return;
    const parsed = this.parseInput(v.trim());
    if (parsed) {
      this.hour = parsed.hour;
      this.minute = parsed.minute;
      this.period = parsed.period;
    }
  }

  private parseInput(v: string): { hour: number; minute: number; period: 'AM' | 'PM' } | null {
    const upper = v.toUpperCase();
    const hasPm = upper.includes('PM');
    const period: 'AM' | 'PM' = hasPm ? 'PM' : 'AM';
    let clean = v.replace(/\s*(AM|PM)\s*/gi, '').trim().replace(/\s/g, '');
    const match = clean.match(/^(\d{1,2}):(\d{1,2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
        return { hour: h, minute: m, period };
      }
    }
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 3) {
      const h = parseInt(digitsOnly.slice(0, 2), 10);
      const m = parseInt(digitsOnly.slice(2, 4).padEnd(2, '0'), 10);
      if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
        return { hour: h, minute: m, period };
      }
    }
    if (digitsOnly.length === 2) {
      const h = parseInt(digitsOnly, 10);
      if (h >= 1 && h <= 12) {
        return { hour: h, minute: 0, period };
      }
    }
    if (digitsOnly.length === 1) {
      const h = parseInt(digitsOnly, 10);
      if (h >= 1 && h <= 9) {
        return { hour: h, minute: 0, period };
      }
    }
    return null;
  }

  private scrollToSelected(): void {
    try {
      const hourEl = this.hoursScroll?.nativeElement?.querySelector(`[data-hour="${this.hour}"]`);
      const minEl = this.minutesScroll?.nativeElement?.querySelector(`[data-minute="${this.minute}"]`);
      if (hourEl) hourEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      if (minEl) minEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } catch {}
  }
}
