import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatComponent } from './mat.component';

describe('MatZoneComponent', () => {
  let component: MatComponent;
  let fixture: ComponentFixture<MatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
