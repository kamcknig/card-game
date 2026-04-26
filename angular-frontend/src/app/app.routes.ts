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
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard, serverHealthGuard],
    children: [
      // Bare /profile falls through to security. Navigation from ProfileMenuComponent
      // always targets /profile/security or /profile/settings directly.
      { path: '', redirectTo: 'security', pathMatch: 'full' },
      { path: 'security', component: ProfileSecurityComponent, title: 'Dominion - Profile' },
      { path: 'settings', component: ProfileSettingsComponent, title: 'Dominion - Settings' },
    ],
  },
  { path: 'configuration', component: MatchConfigurationComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion - Match Configuration' },
  // Title is overridden dynamically by match-scene.ts once the player name is known.
  { path: 'match', component: MatchComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion' },
  { path: 'game-summary', component: GameSummaryComponent, canActivate: [authGuard, serverHealthGuard], title: 'Dominion - Game Summary' },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
