import { assertEquals } from '@std/assert';
import { formatCardName } from '../format-card-name.ts';

Deno.test('formatCardName converts dash-separated keys to title words', () => {
  assertEquals(formatCardName('smithy-village'), 'Smithy Village');
});

Deno.test('formatCardName converts underscore-separated keys to title words', () => {
  assertEquals(formatCardName('haunted_woods'), 'Haunted Woods');
});

Deno.test('formatCardName collapses repeated separators and trims empty words', () => {
  assertEquals(formatCardName('--lost__city--'), 'Lost City');
});
