import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewPasswordFieldsComponent } from './new-password-fields.component';

describe('NewPasswordFieldsComponent', () => {
  let component: NewPasswordFieldsComponent;
  let fixture: ComponentFixture<NewPasswordFieldsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewPasswordFieldsComponent],
      // App uses provideZonelessChangeDetection; TestBed must match.
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(NewPasswordFieldsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has empty primary and confirm values on init', () => {
    expect(component.primary()).toBe('');
    expect(component.confirm()).toBe('');
  });

  it('mismatch stays false while the confirm input is empty (no error flash)', () => {
    // Primary typed, confirm not yet touched: mismatch must stay false so the
    // error does not show on the first keystroke.
    component.primary.set('correcthorse');
    expect(component.confirm()).toBe('');
    expect(component.mismatch()).toBe(false);
  });

  it('mismatch becomes true when confirm differs from primary', () => {
    component.primary.set('correcthorse');
    component.confirm.set('correcthors');
    expect(component.mismatch()).toBe(true);
  });

  it('mismatch returns false when values match', () => {
    component.primary.set('correcthorse');
    component.confirm.set('correcthorse');
    expect(component.mismatch()).toBe(false);
  });

  it('mismatch clears if the user finishes typing the correct confirm', () => {
    component.primary.set('correcthorse');
    // Half-typed mismatch → true.
    component.confirm.set('correct');
    expect(component.mismatch()).toBe(true);
    // Completes to match → clears.
    component.confirm.set('correcthorse');
    expect(component.mismatch()).toBe(false);
  });

  it('toggleShowPassword flips the showPassword signal', () => {
    expect(component.showPassword()).toBe(false);
    component.toggleShowPassword();
    expect(component.showPassword()).toBe(true);
    component.toggleShowPassword();
    expect(component.showPassword()).toBe(false);
  });

  it('confirm input is disabled in the DOM until primary has a value', () => {
    // Render a host that feeds `primary` two-way so we can observe the
    // resulting `[disabled]` attribute on the confirm input element.
    const confirmInput = fixture.nativeElement.querySelectorAll('input[type="password"]')[1] as HTMLInputElement;
    expect(confirmInput.disabled).toBe(true);

    component.primary.set('abc');
    fixture.detectChanges();
    expect(confirmInput.disabled).toBe(false);
  });

  it('renders the mismatch error only when mismatch is true', () => {
    // No error before the user types into confirm.
    expect(fixture.nativeElement.querySelector('.form-field-error')).toBeNull();

    component.primary.set('correcthorse');
    component.confirm.set('wrong');
    fixture.detectChanges();
    const err = fixture.nativeElement.querySelector('.form-field-error') as HTMLElement;
    expect(err).toBeTruthy();
    expect(err.textContent).toContain('Passwords do not match');
  });

  it('inputs flip between password and text type when showPassword changes', () => {
    const [primaryInput, confirmInput] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];

    expect(primaryInput.type).toBe('password');
    expect(confirmInput.type).toBe('password');

    component.toggleShowPassword();
    fixture.detectChanges();

    expect(primaryInput.type).toBe('text');
    expect(confirmInput.type).toBe('text');
  });
});
