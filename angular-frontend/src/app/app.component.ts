import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatchConfigurationComponent } from './match-configuration/match-configuration.component';
import { MatchComponent } from './match/match.component';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatchConfigurationComponent,
    MatchComponent,
    NgSwitch,
    NgSwitchCase
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [SocketService]
})
export class AppComponent {
  public view: string = 'match-configuration';

  title = 'Dominion Clone';
}
