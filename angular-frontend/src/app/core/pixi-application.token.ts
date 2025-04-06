// pixi-application.token.ts
import { InjectionToken } from '@angular/core';
import { Application } from 'pixi.js';

export const PIXI_APP = new InjectionToken<Application>('PixiApplication');
