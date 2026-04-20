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

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'lobby', component: LobbyComponent, canActivate: [authGuard] },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
    children: [
      { path: 'security', component: ProfileSecurityComponent },
      { path: 'settings', component: ProfileSettingsComponent },
      { path: '', redirectTo: 'security', pathMatch: 'full' },
    ],
  },
  { path: 'configuration', component: MatchConfigurationComponent, canActivate: [authGuard] },
  { path: 'match', component: MatchComponent, canActivate: [authGuard] },
  { path: 'game-summary', component: GameSummaryComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
