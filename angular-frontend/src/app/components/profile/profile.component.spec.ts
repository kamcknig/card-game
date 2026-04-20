import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NanostoresService } from '@nanostores/angular';
import { EMPTY, of } from 'rxjs';

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

/**
 * Stub Router — provides the minimal surface that RouterLink and RouterLinkActive
 * need to initialize without errors. RouterLinkActive subscribes to `events` in
 * its constructor; RouterLink calls `createUrlTree` and `serializeUrl` to build
 * the href; `isActive` is checked by RouterLinkActive to set the active class.
 */
class RouterStub {
  url = '/profile/security';
  navigate = jest.fn().mockResolvedValue(true);
  /** RouterLinkActive subscribes to this in its constructor. */
  events = EMPTY;
  createUrlTree = jest.fn().mockReturnValue({});
  serializeUrl = jest.fn().mockReturnValue('');
  isActive = jest.fn().mockReturnValue(false);
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

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('backToLobby navigates to /lobby', () => {
    component.backToLobby();

    expect(routerStub.navigate).toHaveBeenCalledWith(['/lobby']);
  });
});
