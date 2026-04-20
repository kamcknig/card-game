import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { sceneStore } from '../../state/game-state';
import { profileTabStore } from '../../state/profile-state';
import { ProfileComponent } from './profile.component';

/**
 * Stub NanostoresService — ProfileComponent does not subscribe to any stores
 * directly, but shared ancestor components rendered in its tree (scene banner)
 * may. Returning the store's current value keeps those safe.
 */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation((store: { get(): unknown }) => of(store.get()));
  ngOnDestroy = () => {};
}

class RouterStub {
  url = '/profile';
  navigate = jest.fn().mockResolvedValue(true);
}

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let routerStub: RouterStub;

  beforeEach(async () => {
    routerStub = new RouterStub();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: { firstChild: null } },
      ],
    }).compileComponents();

    // Reset shared atoms so state from one test does not leak into the next.
    profileTabStore.set('security');
    sceneStore.set('profile');
  });

  it('should create', () => {
    routerStub.url = '/profile/security';
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('backToLobby sets sceneStore to lobby', () => {
    routerStub.url = '/profile/security';
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.backToLobby();

    expect(sceneStore.get()).toBe('lobby');
  });

  it('ngOnInit on bare /profile URL navigates to the tab stored in profileTabStore', () => {
    routerStub.url = '/profile';
    profileTabStore.set('settings');

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(routerStub.navigate).toHaveBeenCalledWith(
      ['settings'],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it('ngOnInit on /profile/security (refresh) does not override the URL', () => {
    routerStub.url = '/profile/security';
    profileTabStore.set('settings'); // even if store says settings, URL wins

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('ngOnInit on /profile/settings (refresh) does not override the URL', () => {
    routerStub.url = '/profile/settings';
    profileTabStore.set('security');

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(routerStub.navigate).not.toHaveBeenCalled();
  });
});
