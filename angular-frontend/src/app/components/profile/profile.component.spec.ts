import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { AuthService, authIsAdminStore } from '../../core/auth/auth.service';
import { sceneStore } from '../../state/game-state';
import { profileTabStore } from '../../state/profile-state';
import { ProfileComponent } from './profile.component';

/**
 * Stub NanostoresService — covers SceneBannerComponent's auth username
 * subscription which is part of the ProfileComponent render tree.
 */
class NanostoresServiceStub {
  useStore = jasmine.createSpy('useStore').and.callFake(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub AuthService exposing only the methods ProfileComponent calls.
 * Result fields are tunable per test.
 */
class AuthServiceStub {
  changePasswordResult: { ok: boolean; message?: string; revokedSessions?: number } = { ok: true };
  changePassword = jasmine
    .createSpy('changePassword')
    .and.callFake(async () => this.changePasswordResult);

  listCodesResult: { ok: boolean; codes?: any[]; message?: string } = { ok: true, codes: [] };
  listRegistrationCodes = jasmine
    .createSpy('listRegistrationCodes')
    .and.callFake(async () => this.listCodesResult);

  createCodeResult: { ok: boolean; code?: string; message?: string } = { ok: true, code: 'TEST-CODE' };
  createRegistrationCode = jasmine
    .createSpy('createRegistrationCode')
    .and.callFake(async () => this.createCodeResult);

  disableCodeResult: { ok: boolean; message?: string } = { ok: true };
  disableRegistrationCode = jasmine
    .createSpy('disableRegistrationCode')
    .and.callFake(async () => this.disableCodeResult);
}

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let authStub: AuthServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    // Reset shared atoms so state from one test does not leak into the next.
    profileTabStore.set('security');
    sceneStore.set('profile');
    authIsAdminStore.set(false);

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit reads profileTabStore to set the initial active tab', () => {
    // Default 'security' was set in beforeEach — verify it initialised correctly.
    expect(component.selectedNav()).toBe('security');
  });

  it('ngOnInit picks up a non-default tab from profileTabStore', async () => {
    // Reset the store to 'settings' before component construction.
    profileTabStore.set('settings');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ProfileComponent);
    f.detectChanges();

    expect(f.componentInstance.selectedNav()).toBe('settings');
  });

  it('selectNav switches the active tab', () => {
    component.selectNav('settings');
    expect(component.selectedNav()).toBe('settings');

    component.selectNav('security');
    expect(component.selectedNav()).toBe('security');
  });

  it('backToLobby sets sceneStore to lobby', () => {
    component.backToLobby();
    expect(sceneStore.get()).toBe('lobby');
  });

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

  // --- Admin / registration code tests ---

  it('isAdmin() reflects authIsAdminStore at construction time (non-admin)', () => {
    // authIsAdminStore was reset to false in beforeEach.
    expect(component.isAdmin()).toBe(false);
  });

  it('isAdmin() reflects authIsAdminStore at construction time (admin)', async () => {
    authIsAdminStore.set(true);

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ProfileComponent);
    f.detectChanges();

    expect(f.componentInstance.isAdmin()).toBe(true);
  });

  it('ngOnInit: does not load registration codes when non-admin', () => {
    // authIsAdminStore is false; the stub should not have been called.
    expect(authStub.listRegistrationCodes).not.toHaveBeenCalled();
  });

  it('ngOnInit: loads registration codes when admin', async () => {
    authIsAdminStore.set(true);
    authStub.listCodesResult = { ok: true, codes: [{ code: 'ABC', createdAt: 0, createdBy: 'alice', expiresAt: null, maxUses: 1, usedCount: 0 }] };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ProfileComponent);
    f.detectChanges();
    // Allow the async _loadRegistrationCodes to complete.
    await Promise.resolve();

    expect(authStub.listRegistrationCodes).toHaveBeenCalled();
    expect(f.componentInstance.regCodes().length).toBe(1);
  });

  it('submitCreateRegistrationCode: success sets regCodeResult and refreshes list', async () => {
    authStub.createCodeResult = { ok: true, code: 'NEW-CODE' };
    authStub.listCodesResult = { ok: true, codes: [] };

    await component.submitCreateRegistrationCode();

    expect(authStub.createRegistrationCode).toHaveBeenCalled();
    expect(component.regCodeResult()).toBe('NEW-CODE');
    expect(component.regCodeError()).toBeUndefined();
    expect(authStub.listRegistrationCodes).toHaveBeenCalled();
  });

  it('submitCreateRegistrationCode: server failure sets regCodeError', async () => {
    authStub.createCodeResult = { ok: false, message: 'forbidden' };

    await component.submitCreateRegistrationCode();

    expect(component.regCodeError()).toBe('forbidden');
    expect(component.regCodeResult()).toBeUndefined();
  });

  it('submitCreateRegistrationCode: submitting flag is cleared after success and failure', async () => {
    authStub.createCodeResult = { ok: true, code: 'X' };
    authStub.listCodesResult = { ok: true, codes: [] };

    await component.submitCreateRegistrationCode();
    expect(component.regCodeSubmitting()).toBe(false);

    authStub.createCodeResult = { ok: false, message: 'err' };
    await component.submitCreateRegistrationCode();
    expect(component.regCodeSubmitting()).toBe(false);
  });

  it('disableRegistrationCode: calls service then refreshes list', async () => {
    authStub.listCodesResult = { ok: true, codes: [] };

    await component.disableRegistrationCode('SOME-CODE');

    expect(authStub.disableRegistrationCode).toHaveBeenCalledWith('SOME-CODE');
    expect(authStub.listRegistrationCodes).toHaveBeenCalled();
  });
});
