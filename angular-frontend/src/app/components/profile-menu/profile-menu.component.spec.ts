import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';
import { ProfileMenuComponent } from './profile-menu.component';

/**
 * Stub NanostoresService — ProfileMenuComponent subscribes to authUsernameStore
 * via useStore. Returning a static observable keeps the test deterministic.
 */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub AuthService — only `logout` is called by ProfileMenuComponent.
 */
class AuthServiceStub {
  logout = jest.fn().mockResolvedValue(undefined);
}

/**
 * Stub SocketService — ProfileMenuComponent calls `disconnect` on logout.
 */
class SocketServiceStub {
  disconnect = jest.fn();
}

/**
 * Stub Router — ProfileMenuComponent calls navigate() for profile, settings, and logout.
 */
class RouterStub {
  navigate = jest.fn().mockResolvedValue(true);
}

describe('ProfileMenuComponent', () => {
  let component: ProfileMenuComponent;
  let fixture: ComponentFixture<ProfileMenuComponent>;
  let authStub: AuthServiceStub;
  let socketStub: SocketServiceStub;
  let routerStub: RouterStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();
    socketStub = new SocketServiceStub();
    routerStub = new RouterStub();

    await TestBed.configureTestingModule({
      imports: [ProfileMenuComponent],
      providers: [
        // App uses provideZonelessChangeDetection; TestBed must match.
        provideZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: AuthService, useValue: authStub },
        { provide: SocketService, useValue: socketStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

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
    // Use Jest's spyOn to replace the stopPropagation method with a spy.
    jest.spyOn(event, 'stopPropagation');

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

  it('openProfile navigates to /profile and closes the dropdown', () => {
    component.dropdownOpen.set(true);

    component.openProfile();

    expect(routerStub.navigate).toHaveBeenCalledWith(['/profile']);
    expect(component.dropdownOpen()).toBe(false);
  });

  it('openSettings navigates to /settings and closes the dropdown', () => {
    component.dropdownOpen.set(true);

    component.openSettings();

    expect(routerStub.navigate).toHaveBeenCalledWith(['/settings']);
    expect(component.dropdownOpen()).toBe(false);
  });

  it('logout calls auth.logout, disconnects the socket, navigates to /login, and closes the dropdown', async () => {
    component.dropdownOpen.set(true);

    await component.logout();

    expect(authStub.logout).toHaveBeenCalled();
    expect(socketStub.disconnect).toHaveBeenCalled();
    expect(routerStub.navigate).toHaveBeenCalledWith(['/login']);
    expect(component.dropdownOpen()).toBe(false);
  });
});
