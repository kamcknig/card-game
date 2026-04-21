import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService, pendingRegistrationCodeStore } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

/**
 * Stub AuthService that avoids real fetch calls during tests. The debounced
 * username-availability pipeline in LoginComponent invokes
 * `checkUsernameAvailability`; returning a resolved promise keeps it quiet.
 */
class AuthServiceStub {
  loginResult: { ok: boolean; message?: string } = { ok: true };
  registerResult: { ok: boolean; message?: string } = { ok: true };
  usernameAvailable = true;
  validateCodeResult: { ok: boolean; valid: boolean } = { ok: true, valid: true };

  login = jest.fn().mockImplementation(async () => this.loginResult);
  register = jest.fn().mockImplementation(async () => this.registerResult);
  checkUsernameAvailability = jest
    .fn()
    .mockImplementation(async () => this.usernameAvailable);
  validateRegistrationCode = jest
    .fn()
    .mockImplementation(async () => this.validateCodeResult);
}

/**
 * Stub Router — LoginComponent calls navigate() on successful sign-in.
 */
class RouterStub {
  navigate = jest.fn().mockResolvedValue(true);
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authStub: AuthServiceStub;
  let routerStub: RouterStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();
    routerStub = new RouterStub();

    // Ensure no deep-link code is staged before the component is constructed.
    pendingRegistrationCodeStore.set(undefined);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Guarantee the store is empty after each test regardless of what the test did.
    pendingRegistrationCodeStore.set(undefined);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in signin mode with empty fields', () => {
    expect(component.mode()).toBe('signin');
    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
    expect(component.confirmPassword()).toBe('');
    expect(component.registrationCode()).toBe('');
  });

  it('setMode clears every field and transient message', () => {
    // Populate some state as if the user was mid-flow.
    component.username.set('alice');
    component.password.set('pw');
    component.confirmPassword.set('pw2');
    component.registrationCode.set('abcd');
    component.errorMessage.set('bad');
    component.successMessage.set('good');
    component.usernameError.set('taken');

    component.setMode('register');

    expect(component.mode()).toBe('register');
    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
    expect(component.confirmPassword()).toBe('');
    expect(component.registrationCode()).toBe('');
    expect(component.errorMessage()).toBeUndefined();
    expect(component.successMessage()).toBeUndefined();
    expect(component.usernameError()).toBeUndefined();
  });

  it('toggleShowPassword flips the signin password visibility signal', () => {
    expect(component.showPassword()).toBe(false);
    component.toggleShowPassword();
    expect(component.showPassword()).toBe(true);
    component.toggleShowPassword();
    expect(component.showPassword()).toBe(false);
  });

  it('signin: failing login surfaces the server message without navigating', async () => {
    authStub.loginResult = { ok: false, message: 'Username/password does not match' };
    component.username.set('alice');
    component.password.set('wrong');
    await component.onSubmit();

    expect(authStub.login).toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Username/password does not match');
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('signin: successful login navigates to the lobby route', async () => {
    authStub.loginResult = { ok: true };
    component.username.set('alice');
    component.password.set('dominion');
    await component.onSubmit();

    expect(routerStub.navigate).toHaveBeenCalledWith(['/lobby']);
    expect(component.errorMessage()).toBeUndefined();
  });

  it('register: successful submit returns to signin with a success toast and prefilled username', async () => {
    component.setMode('register');
    component.username.set('alice');
    component.password.set('correcthorse');
    component.confirmPassword.set('correcthorse');
    component.registrationCode.set('code123');

    await component.onSubmit();

    expect(authStub.register).toHaveBeenCalledWith('alice', 'correcthorse', 'code123');
    expect(component.mode()).toBe('signin');
    expect(component.username()).toBe('alice');
    expect(component.successMessage()).toContain('Account created');
  });

  it('register: mismatched confirm password short-circuits submit before calling register', async () => {
    component.setMode('register');
    component.username.set('alice');
    component.password.set('correcthorse');
    component.confirmPassword.set('WRONG');
    component.registrationCode.set('code123');

    await component.onSubmit();

    expect(authStub.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Passwords do not match');
  });

  it('register: missing registration code is reported before calling register', async () => {
    component.setMode('register');
    component.username.set('alice');
    component.password.set('correcthorse');
    component.confirmPassword.set('correcthorse');
    component.registrationCode.set('');

    await component.onSubmit();

    expect(authStub.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Registration code is required');
  });

  it('register: server failure message is surfaced to the user', async () => {
    authStub.registerResult = { ok: false, message: 'Invalid or expired registration code' };
    component.setMode('register');
    component.username.set('alice');
    component.password.set('correcthorse');
    component.confirmPassword.set('correcthorse');
    component.registrationCode.set('code123');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Invalid or expired registration code');
    expect(component.mode()).toBe('register');
  });

  it('requires both username and password before submitting', async () => {
    component.username.set('');
    component.password.set('');
    await component.onSubmit();

    expect(authStub.login).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Username and password are required');
  });

  // --- Deep-link pre-fill and code validation ---

  it('constructor: switches to register mode and pre-fills code from pendingRegistrationCodeStore', async () => {
    pendingRegistrationCodeStore.set('DEEP-CODE-123');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();

    expect(f.componentInstance.mode()).toBe('register');
    expect(f.componentInstance.registrationCode()).toBe('DEEP-CODE-123');
  });

  it('constructor: clears pendingRegistrationCodeStore after reading it', async () => {
    pendingRegistrationCodeStore.set('DEEP-CODE-123');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    TestBed.createComponent(LoginComponent);

    expect(pendingRegistrationCodeStore.get()).toBeUndefined();
  });

  it('constructor: stays in signin mode when pendingRegistrationCodeStore is empty', () => {
    // The beforeEach already creates the component with an empty store.
    expect(component.mode()).toBe('signin');
    expect(component.registrationCode()).toBe('');
  });

  it('ngOnInit: does not call validateRegistrationCode when no deep-link code was staged', () => {
    // The component was created in beforeEach with an empty store, so no validation should occur.
    expect(authStub.validateRegistrationCode).not.toHaveBeenCalled();
  });

  it('ngOnInit: does not show modal when the deep-link code is valid', async () => {
    authStub.validateCodeResult = { ok: true, valid: true };
    pendingRegistrationCodeStore.set('VALID-CODE');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    // Flush the microtask queue so the validateRegistrationCode .then() callback runs.
    await Promise.resolve();

    expect(authStub.validateRegistrationCode).toHaveBeenCalledWith('VALID-CODE');
    expect(f.componentInstance.showInvalidCodeModal()).toBe(false);
    // Code should remain pre-filled.
    expect(f.componentInstance.registrationCode()).toBe('VALID-CODE');
  });

  it('ngOnInit: shows invalid-code modal and clears code when deep-link code is invalid', async () => {
    authStub.validateCodeResult = { ok: true, valid: false };
    pendingRegistrationCodeStore.set('BAD-CODE');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    // Flush the microtask queue so the .then() callback sets the modal signal.
    await Promise.resolve();

    expect(authStub.validateRegistrationCode).toHaveBeenCalledWith('BAD-CODE');
    expect(f.componentInstance.showInvalidCodeModal()).toBe(true);
    // Invalid code should be cleared so the field is ready for manual entry.
    expect(f.componentInstance.registrationCode()).toBe('');
  });

  it('dismissInvalidCodeModal: sets showInvalidCodeModal to false', async () => {
    component.showInvalidCodeModal.set(true);
    component.dismissInvalidCodeModal();
    expect(component.showInvalidCodeModal()).toBe(false);
  });
});
