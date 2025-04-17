import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatZoneComponent } from './mat-zone.component';

describe('MatZoneComponent', () => {
  let component: MatZoneComponent;
  let fixture: ComponentFixture<MatZoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatZoneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatZoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
