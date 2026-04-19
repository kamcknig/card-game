import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';
import { sceneStore } from '../../state/game-state';
import { LobbyComponent } from './lobby.component';

/**
 * Stub NanostoresService that skips the real subscription path and returns
 * static observables per store. Only `useStore` is used by LobbyComponent.
 */
class NanostoresServiceStub {
  useStore = jasmine.createSpy('useStore').and.callFake(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub SocketService — LobbyComponent calls `emit` on init and on actions,
 * and `disconnect` on logout. Tracking the calls is enough for assertions.
 */
class SocketServiceStub {
  emit = jasmine.createSpy('emit');
  disconnect = jasmine.createSpy('disconnect');
}

/**
 * Stub AuthService exposing only the methods LobbyComponent touches.
 * `changePassword` result is tunable per test.
 */
class AuthServiceStub {
  changePasswordResult: { ok: boolean; message?: string; revokedSessions?: number } = { ok: true };
  logout = jasmine.createSpy('logout').and.resolveTo(undefined);
  changePassword = jasmine
    .createSpy('changePassword')
    .and.callFake(async () => this.changePasswordResult);
}

describe('LobbyComponent', () => {
  let component: LobbyComponent;
  let fixture: ComponentFixture<LobbyComponent>;
  let authStub: AuthServiceStub;
  let socketStub: SocketServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();
    socketStub = new SocketServiceStub();

    await TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: SocketService, useValue: socketStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Reset shared scene state between tests so a logout() in one test does
    // not leak sceneStore='login' into another.
    sceneStore.set('lobby');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('change-password dialog starts closed with empty fields', () => {
    expect(component.changePasswordOpen()).toBe(false);
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
    expect(component.changePasswordError()).toBeUndefined();
    expect(component.changePasswordSuccess()).toBeUndefined();
  });

  it('openChangePassword opens the dialog with a freshly cleared form', () => {
    // Simulate residual state from a prior close.
    component.currentPassword.set('old');
    component.newPassword.set('new');
    component.confirmNewPassword.set('new');
    component.changePasswordError.set('stale');
    component.changePasswordSuccess.set('stale');

    component.openChangePassword();

    expect(component.changePasswordOpen()).toBe(true);
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
    expect(component.changePasswordError()).toBeUndefined();
    expect(component.changePasswordSuccess()).toBeUndefined();
  });

  it('closeChangePassword closes the dialog and wipes the form', () => {
    component.openChangePassword();
    component.currentPassword.set('old');
    component.newPassword.set('new');
    component.confirmNewPassword.set('new');

    component.closeChangePassword();

    expect(component.changePasswordOpen()).toBe(false);
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
  });

  it('submitChangePassword: missing fields reports the required-field error', async () => {
    component.openChangePassword();

    await component.submitChangePassword();

    expect(authStub.changePassword).not.toHaveBeenCalled();
    expect(component.changePasswordError()).toBe('Both fields are required');
  });

  it('submitChangePassword: mismatched confirm is rejected before hitting the server', async () => {
    component.openChangePassword();
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('different');

    await component.submitChangePassword();

    expect(authStub.changePassword).not.toHaveBeenCalled();
    expect(component.changePasswordError()).toBe('Passwords do not match');
  });

  it('submitChangePassword: happy path clears fields and reports revoked sessions', async () => {
    authStub.changePasswordResult = { ok: true, revokedSessions: 2 };
    component.openChangePassword();
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(authStub.changePassword).toHaveBeenCalledWith('oldpw', 'newpw-long');
    expect(component.changePasswordSuccess()).toContain('2');
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
  });

  it('submitChangePassword: server failure is surfaced verbatim and fields are kept', async () => {
    authStub.changePasswordResult = { ok: false, message: 'Current password incorrect' };
    component.openChangePassword();
    component.currentPassword.set('oldpw');
    component.newPassword.set('newpw-long');
    component.confirmNewPassword.set('newpw-long');

    await component.submitChangePassword();

    expect(component.changePasswordError()).toBe('Current password incorrect');
    // Fields preserved so the user can correct without retyping everything.
    expect(component.currentPassword()).toBe('oldpw');
  });

  it('logout disconnects the socket and returns to the login scene', async () => {
    await component.logout();

    expect(authStub.logout).toHaveBeenCalled();
    expect(socketStub.disconnect).toHaveBeenCalled();
    expect(sceneStore.get()).toBe('login');
  });

  it('ngOnInit requests a lobby snapshot', () => {
    // LobbyComponent calls emit('requestLobbySnapshot') at init — the
    // beforeEach detectChanges() already triggered it.
    expect(socketStub.emit).toHaveBeenCalledWith('requestLobbySnapshot');
  });
});
