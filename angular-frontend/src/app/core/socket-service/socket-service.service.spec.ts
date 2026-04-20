import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SocketService } from './socket.service';

describe('SocketServiceService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
      providers: [provideExperimentalZonelessChangeDetection()],
    });
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
