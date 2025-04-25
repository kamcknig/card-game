import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectKingdomModalComponent } from './select-kingdom-modal.component';

describe('SelectKingdomModalComponent', () => {
  let component: SelectKingdomModalComponent;
  let fixture: ComponentFixture<SelectKingdomModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectKingdomModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectKingdomModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
