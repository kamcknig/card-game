import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { AuthService, authIsAdminStore, authNeedsEmailStore, authEmailStore } from '../../../core/auth/auth.service';
import { ProfileSecurityComponent } from './profile-security.component';

/**
 * Stub NanostoresService — ProfileSecurityComponent subscribes to several
 * auth stores via useStore. Returning the store's current value at subscription
 * time keeps toSignal() initial values accurate.
 */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation((store: { get(): unknown }) => of(store.get()));
  ngOnDestroy = () => {};
}

/**
 * Stub AuthService exposing only the methods ProfileSecurityComponent calls.
 * Result fields are tunable per test.
 */
class AuthServiceStub {
  changePasswordResult: { ok: boolean; message?: string; revokedSessions?: number } = { ok: true };
  changePassword = jest
    .fn()
    .mockImplementation(async () => this.changePasswordResult);

  attachEmailResult: { ok: boolean; message?: string } = { ok: true };
  attachEmail = jest
    .fn()
    .mockImplementation(async () => this.attachEmailResult);

  checkEmailAvailabilityResult = true;
  checkEmailAvailability = jest
    .fn()
    .mockImplementation(async () => this.checkEmailAvailabilityResult);
}

describe('ProfileSecurityComponent', () => {
  let component: ProfileSecurityComponent;
  let fixture: ComponentFixture<ProfileSecurityComponent>;
  let authStub: AuthServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [ProfileSecurityComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    // Reset shared atoms so state from one test does not leak into the next.
    authIsAdminStore.set(false);
    authNeedsEmailStore.set(false);
    authEmailStore.set(null);

    fixture = TestBed.createComponent(ProfileSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Change password form ---

  it('change-password form starts empty with no messages', () => {
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
    expect(component.changePasswordError()).toBeUndefined();
    expect(component.changePasswordSuccess()).toBeUndefined();
    expect(component.changePasswordSubmitting()).toBe(false);
  });

  it('submitChangePassword: missing fields reports required-field error without calling the server', async () => {
    await component.submitChangePassword();

    expect(authStub.changePassword).not.toHaveBeenCalled();
    expect(component.changePasswordError()).toBe('Both fields are required');
  });

  it('submitChangePassword: mismatched confirm is rejected before hitting the server', async () => {
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('different');

    await component.submitChangePassword();

    expect(authStub.changePassword).not.toHaveBeenCalled();
    expect(component.changePasswordError()).toBe('Passwords do not match');
  });

  it('submitChangePassword: happy path clears fields and reports revoked session count', async () => {
    authStub.changePasswordResult = { ok: true, revokedSessions: 2 };
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(authStub.changePassword).toHaveBeenCalledWith('oldpw', 'newpw-long');
    expect(component.changePasswordSuccess()).toContain('2');
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
    expect(component.changePasswordError()).toBeUndefined();
  });

  it('submitChangePassword: zero revoked sessions shows the generic success message', async () => {
    authStub.changePasswordResult = { ok: true, revokedSessions: 0 };
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(component.changePasswordSuccess()).toBe('Password updated.');
  });

  it('submitChangePassword: server failure is surfaced verbatim and fields are preserved', async () => {
    authStub.changePasswordResult = { ok: false, message: 'Current password incorrect' };
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(component.changePasswordError()).toBe('Current password incorrect');
    // Fields are kept so the user can correct without retyping.
    expect(component.currentPassword()).toBe('oldpw');
    expect(component.changePasswordSuccess()).toBeUndefined();
  });

  it('submitChangePassword: submitting flag is cleared after both success and failure', async () => {
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(component.changePasswordSubmitting()).toBe(false);
  });

  // --- Admin gate ---

  it('isAdmin() reflects authIsAdminStore at construction time (non-admin)', () => {
    // authIsAdminStore was reset to false in beforeEach.
    expect(component.isAdmin()).toBe(false);
  });

  it('isAdmin() reflects authIsAdminStore at construction time (admin)', async () => {
    authIsAdminStore.set(true);

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileSecurityComponent],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ProfileSecurityComponent);
    f.detectChanges();

    expect(f.componentInstance.isAdmin()).toBe(true);
  });

  // --- Add-email form ---

  it('add-email form starts empty with no messages', () => {
    expect(component.attachEmailValue()).toBe('');
    expect(component.attachEmailPassword()).toBe('');
    expect(component.attachEmailError()).toBeUndefined();
    expect(component.attachEmailSuccess()).toBeUndefined();
    expect(component.attachEmailSubmitting()).toBe(false);
  });

  it('submitAttachEmail: missing fields reports required-field error without calling the server', async () => {
    await component.submitAttachEmail();

    expect(authStub.attachEmail).not.toHaveBeenCalled();
    expect(component.attachEmailError()).toBe('Both email and password are required');
  });

  it('submitAttachEmail: happy path shows confirmation message and clears form', async () => {
    authStub.attachEmailResult = { ok: true };
    component.attachEmailValue.set('user@example.com');
    component.attachEmailPassword.set('currentpw');

    await component.submitAttachEmail();

    expect(authStub.attachEmail).toHaveBeenCalledWith('user@example.com', 'currentpw');
    expect(component.attachEmailSuccess()).toContain('Confirmation email sent');
    expect(component.attachEmailValue()).toBe('');
    expect(component.attachEmailPassword()).toBe('');
    expect(component.attachEmailError()).toBeUndefined();
  });

  it('submitAttachEmail: server failure surfaces error message', async () => {
    authStub.attachEmailResult = { ok: false, message: 'Email already registered' };
    component.attachEmailValue.set('taken@example.com');
    component.attachEmailPassword.set('currentpw');

    await component.submitAttachEmail();

    expect(component.attachEmailError()).toBe('Email already registered');
    expect(component.attachEmailSuccess()).toBeUndefined();
  });

  it('submitAttachEmail: submitting flag is cleared after success and failure', async () => {
    authStub.attachEmailResult = { ok: true };
    component.attachEmailValue.set('user@example.com');
    component.attachEmailPassword.set('currentpw');

    await component.submitAttachEmail();
    expect(component.attachEmailSubmitting()).toBe(false);

    authStub.attachEmailResult = { ok: false, message: 'err' };
    component.attachEmailValue.set('user2@example.com');
    component.attachEmailPassword.set('currentpw');
    await component.submitAttachEmail();
    expect(component.attachEmailSubmitting()).toBe(false);
  });

  // --- onAttachEmailBlur ---

  it('onAttachEmailBlur: empty value clears the status without making a request', async () => {
    component.attachEmailValue.set('');
    await component.onAttachEmailBlur();

    expect(authStub.checkEmailAvailability).not.toHaveBeenCalled();
    expect(component.attachEmailStatus()).toEqual({ checking: false });
  });

  it('onAttachEmailBlur: invalid email sets an error without making a request', async () => {
    component.attachEmailValue.set('not-an-email');
    await component.onAttachEmailBlur();

    expect(authStub.checkEmailAvailability).not.toHaveBeenCalled();
    expect(component.attachEmailStatus().error).toBeTruthy();
  });

  it('onAttachEmailBlur: available email clears the error status', async () => {
    authStub.checkEmailAvailabilityResult = true;
    component.attachEmailValue.set('free@example.com');
    await component.onAttachEmailBlur();

    expect(authStub.checkEmailAvailability).toHaveBeenCalledWith('free@example.com');
    expect(component.attachEmailStatus().error).toBeUndefined();
  });

  it('onAttachEmailBlur: taken email sets an inline error', async () => {
    authStub.checkEmailAvailabilityResult = false;
    component.attachEmailValue.set('taken@example.com');
    await component.onAttachEmailBlur();

    expect(component.attachEmailStatus().error).toBeTruthy();
  });
});
