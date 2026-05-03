import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { ProfileComponent } from './components/profile/profile.component';
import { ProfileSecurityComponent } from './components/profile/security/profile-security.component';
import { ProfileSettingsComponent } from './components/profile/settings/profile-settings.component';
import { MatchConfigurationComponent } from './components/match-configuration/match-configuration.component';
import { MatchComponent } from './components/match/match.component';
import { GameSummaryComponent } from './components/game-summary/game-summary.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { serverHealthGuard, serverStatusRedirectGuard } from './core/guards/server-health.guard';
import { noActiveMatchGuard } from './core/guards/match-started.guard';

export const routes: Routes = [
  {
    path: 'server-status',
    loadComponent: () => import('./server-status/server-status.component').then(m => m.ServerStatusComponent),
    canActivate: [serverStatusRedirectGuard],
    title: 'Dominion - Server Status',
  },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'Dominion' },
  { path: 'lobby', component: LobbyComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion - Lobby' },
  {
    // /profile renders the account / change-password pane (Profile tab) inside
    // the shared ProfileComponent shell.
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard, serverHealthGuard],
    children: [
      { path: '', component: ProfileSecurityComponent, title: 'Dominion - Profile' },
    ],
  },
  {
    // /settings renders the user-preferences pane (Settings tab) inside the
    // same ProfileComponent shell so the sidebar nav stays consistent.
    path: 'settings',
    component: ProfileComponent,
    canActivate: [authGuard, serverHealthGuard],
    children: [
      { path: '', component: ProfileSettingsComponent, title: 'Dominion - Settings' },
    ],
  },
  { path: 'configuration', component: MatchConfigurationComponent, canActivate: [authGuard, serverHealthGuard, noActiveMatchGuard], title: 'Dominion - Match Configuration' },
  // Title is overridden dynamically by match-scene.ts once the player name is known.
  { path: 'match', component: MatchComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion' },
  { path: 'game-summary', component: GameSummaryComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion - Game Summary' },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
