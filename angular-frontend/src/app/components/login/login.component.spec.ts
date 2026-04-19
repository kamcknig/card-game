import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { sceneStore } from '../../state/game-state';
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

  login = jasmine.createSpy('login').and.callFake(async () => this.loginResult);
  register = jasmine.createSpy('register').and.callFake(async () => this.registerResult);
  checkUsernameAvailability = jasmine
    .createSpy('checkUsernameAvailability')
    .and.callFake(async () => this.usernameAvailable);
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authStub: AuthServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Reset the shared scene atom between tests so sceneStore.set('lobby')
    // from one test does not bleed into the next.
    sceneStore.set('login');
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

  it('signin: failing login surfaces the server message without changing scene', async () => {
    authStub.loginResult = { ok: false, message: 'Username/password does not match' };
    component.username.set('alice');
    component.password.set('wrong');
    await component.onSubmit();

    expect(authStub.login).toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Username/password does not match');
    expect(sceneStore.get()).toBe('login');
  });

  it('signin: successful login transitions to the lobby scene', async () => {
    authStub.loginResult = { ok: true };
    component.username.set('alice');
    component.password.set('dominion');
    await component.onSubmit();

    expect(sceneStore.get()).toBe('lobby');
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
});
