import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';
import { sceneStore } from '../../state/game-state';
import { profileTabStore } from '../../state/profile-state';
import { ProfileMenuComponent } from './profile-menu.component';

/**
 * Stub NanostoresService — ProfileMenuComponent subscribes to authUsernameStore
 * via useStore. Returning a static observable keeps the test deterministic.
 */
class NanostoresServiceStub {
  useStore = jasmine.createSpy('useStore').and.callFake(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub AuthService — only `logout` is called by ProfileMenuComponent.
 */
class AuthServiceStub {
  logout = jasmine.createSpy('logout').and.resolveTo(undefined);
}

/**
 * Stub SocketService — ProfileMenuComponent calls `disconnect` on logout.
 */
class SocketServiceStub {
  disconnect = jasmine.createSpy('disconnect');
}

describe('ProfileMenuComponent', () => {
  let component: ProfileMenuComponent;
  let fixture: ComponentFixture<ProfileMenuComponent>;
  let authStub: AuthServiceStub;
  let socketStub: SocketServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();
    socketStub = new SocketServiceStub();

    await TestBed.configureTestingModule({
      imports: [ProfileMenuComponent],
      providers: [
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
        { provide: SocketService, useValue: socketStub },
      ],
    }).compileComponents();

    // Reset shared atoms so state from one test does not leak into the next.
    sceneStore.set('lobby');
    profileTabStore.set('security');

    fixture = TestBed.createComponent(ProfileMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('dropdown starts closed', () => {
    expect(component.dropdownOpen()).toBe(false);
  });

  it('toggleDropdown opens the dropdown and stops event propagation', () => {
    const event = new MouseEvent('click');
    spyOn(event, 'stopPropagation');

    component.toggleDropdown(event);

    expect(component.dropdownOpen()).toBe(true);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('toggleDropdown closes an already-open dropdown', () => {
    component.dropdownOpen.set(true);
    const event = new MouseEvent('click');

    component.toggleDropdown(event);

    expect(component.dropdownOpen()).toBe(false);
  });

  it('onDocumentClick closes the dropdown when clicking outside the host element', () => {
    component.dropdownOpen.set(true);

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    component.onDocumentClick({ target: outsideEl } as unknown as MouseEvent);

    expect(component.dropdownOpen()).toBe(false);

    document.body.removeChild(outsideEl);
  });

  it('onDocumentClick keeps the dropdown open when clicking inside the host element', () => {
    component.dropdownOpen.set(true);

    // Clicking the host's own nativeElement is always "inside".
    component.onDocumentClick({ target: fixture.nativeElement } as unknown as MouseEvent);

    expect(component.dropdownOpen()).toBe(true);
  });

  it('openProfile sets profileTabStore to security, navigates to profile scene, and closes the dropdown', () => {
    component.dropdownOpen.set(true);
    profileTabStore.set('settings'); // start with a different value to confirm override

    component.openProfile();

    expect(profileTabStore.get()).toBe('security');
    expect(sceneStore.get()).toBe('profile');
    expect(component.dropdownOpen()).toBe(false);
  });

  it('openSettings sets profileTabStore to settings, navigates to profile scene, and closes the dropdown', () => {
    component.dropdownOpen.set(true);

    component.openSettings();

    expect(profileTabStore.get()).toBe('settings');
    expect(sceneStore.get()).toBe('profile');
    expect(component.dropdownOpen()).toBe(false);
  });

  it('logout calls auth.logout, disconnects the socket, navigates to the login scene, and closes the dropdown', async () => {
    component.dropdownOpen.set(true);

    await component.logout();

    expect(authStub.logout).toHaveBeenCalled();
    expect(socketStub.disconnect).toHaveBeenCalled();
    expect(sceneStore.get()).toBe('login');
    expect(component.dropdownOpen()).toBe(false);
  });
});
