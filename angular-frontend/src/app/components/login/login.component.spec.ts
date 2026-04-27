import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

/**
 * Stub AuthService that avoids real fetch calls during tests. The debounced
 * availability pipelines in LoginComponent invoke checkUsernameAvailability
 * and checkEmailAvailability; returning resolved promises keeps them quiet.
 */
class AuthServiceStub {
  loginResult: { ok: boolean; message?: string } = { ok: true };
  registerResult: { ok: boolean; message?: string } = { ok: true };
  usernameAvailable = true;
  emailAvailable = true;

  login = jest.fn().mockImplementation(async () => this.loginResult);
  register = jest.fn().mockImplementation(async () => this.registerResult);
  checkUsernameAvailability = jest
    .fn()
    .mockImplementation(async () => this.usernameAvailable);
  checkEmailAvailability = jest
    .fn()
    .mockImplementation(async () => this.emailAvailable);
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in signin mode with empty fields', () => {
    expect(component.mode()).toBe('signin');
    expect(component.username()).toBe('');
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
    expect(component.confirmPassword()).toBe('');
  });

  it('setMode clears every field and transient message', () => {
    // Populate some state as if the user was mid-flow.
    component.username.set('alice');
    component.email.set('alice@example.com');
    component.password.set('pw');
    component.confirmPassword.set('pw2');
    component.errorMessage.set('bad');
    component.successMessage.set('good');
    component.usernameStatus.set({ checking: false, error: 'taken' });

    component.setMode('register');

    expect(component.mode()).toBe('register');
    expect(component.username()).toBe('');
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
    expect(component.confirmPassword()).toBe('');
    expect(component.errorMessage()).toBeUndefined();
    expect(component.successMessage()).toBeUndefined();
    expect(component.usernameStatus().error).toBeUndefined();
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
    component.email.set('alice@example.com');
    component.password.set('correcthorse');
    component.confirmPassword.set('correcthorse');

    await component.onSubmit();

    // register signature: (username, email, password)
    expect(authStub.register).toHaveBeenCalledWith('alice', 'alice@example.com', 'correcthorse');
    expect(component.mode()).toBe('signin');
    expect(component.username()).toBe('alice');
    expect(component.successMessage()).toContain('Account created');
  });

  it('register: mismatched confirm password short-circuits submit before calling register', async () => {
    component.setMode('register');
    component.username.set('alice');
    component.password.set('correcthorse');
    component.confirmPassword.set('WRONG');

    await component.onSubmit();

    expect(authStub.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Passwords do not match');
  });

  it('register: server failure message is surfaced to the user', async () => {
    authStub.registerResult = { ok: false, message: 'Registration failed' };
    component.setMode('register');
    component.username.set('alice');
    component.email.set('alice@example.com');
    component.password.set('correcthorse');
    component.confirmPassword.set('correcthorse');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Registration failed');
    expect(component.mode()).toBe('register');
  });

  it('requires both username and password before submitting', async () => {
    component.username.set('');
    component.password.set('');
    await component.onSubmit();

    expect(authStub.login).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Username and password are required');
  });

  // --- onEmailBlur availability check ---

  it('onEmailBlur: empty email clears status without calling the server', async () => {
    component.setMode('register');
    component.email.set('');
    await component.onEmailBlur();

    expect(authStub.checkEmailAvailability).not.toHaveBeenCalled();
    expect(component.emailStatus()).toEqual({ checking: false });
  });

  it('onEmailBlur: invalid email sets an error without calling the server', async () => {
    component.setMode('register');
    component.email.set('not-an-email');
    await component.onEmailBlur();

    expect(authStub.checkEmailAvailability).not.toHaveBeenCalled();
    expect(component.emailStatus().error).toBeTruthy();
  });

  it('onEmailBlur: available email clears status error', async () => {
    authStub.emailAvailable = true;
    component.setMode('register');
    component.email.set('free@example.com');
    await component.onEmailBlur();

    expect(authStub.checkEmailAvailability).toHaveBeenCalledWith('free@example.com');
    expect(component.emailStatus().error).toBeUndefined();
  });

  it('onEmailBlur: taken email sets inline error', async () => {
    authStub.emailAvailable = false;
    component.setMode('register');
    component.email.set('taken@example.com');
    await component.onEmailBlur();

    expect(component.emailStatus().error).toBeTruthy();
  });

  it('onEmailBlur: no-ops when in signin mode', async () => {
    // mode defaults to signin.
    component.email.set('any@example.com');
    await component.onEmailBlur();

    expect(authStub.checkEmailAvailability).not.toHaveBeenCalled();
  });
});
