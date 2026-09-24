import { describe, expect, it } from 'vitest';
import {
	createNumericSliderSettings,
	getNumericSliderDirection,
	isNumericSliderAnswerCorrect
} from './numeric-slider';

describe('createNumericSliderSettings', () => {
	it('creates a randomized range on a lattice that contains the target', () => {
		const leftBiased = createNumericSliderSettings(137.5, 1, null, () => 0);
		const rightBiased = createNumericSliderSettings(137.5, 1, null, () => 1);

		expect(leftBiased).not.toBeNull();
		expect(rightBiased).not.toBeNull();
		expect(leftBiased?.min).not.toBe(rightBiased?.min);
		expect((137.5 - leftBiased!.min) / leftBiased!.step).toBeCloseTo(
			Math.round((137.5 - leftBiased!.min) / leftBiased!.step),
			10
		);
		expect(leftBiased!.initialValue).toBe(leftBiased!.min);
		expect(rightBiased!.initialValue).toBe(rightBiased!.min);
	});

	it('respects numeric schema bounds and step', () => {
		const settings = createNumericSliderSettings(
			42,
			2,
			{ minimum: 40, maximum: 50, multipleOf: 0.5 },
			() => 0.5
		);

		expect(settings).not.toBeNull();
		expect(settings!.min).toBeGreaterThanOrEqual(40);
		expect(settings!.max).toBeLessThanOrEqual(50);
		expect(settings!.step).toBe(0.5);
		expect(Number.isInteger((42 - settings!.min) / settings!.step)).toBe(true);
	});

	it('shrinks the accepted error as difficulty increases', () => {
		const easy = createNumericSliderSettings(100, 0, null, () => 0.5);
		const hard = createNumericSliderSettings(100, 3, null, () => 0.5);

		expect(easy).not.toBeNull();
		expect(hard).not.toBeNull();
		expect(hard!.errorMargin).toBeLessThan(easy!.errorMargin);
		expect(hard!.step).toBeLessThanOrEqual(easy!.step);
	});

	it('accepts values inside the margin and rejects values outside it', () => {
		const settings = createNumericSliderSettings(10, 2, null, () => 0.5)!;

		expect(isNumericSliderAnswerCorrect(10 + settings.errorMargin, 10, settings)).toBe(true);
		expect(
			isNumericSliderAnswerCorrect(10 + settings.errorMargin + settings.step, 10, settings)
		).toBe(false);
	});

	it('points toward the target after an incorrect answer', () => {
		expect(getNumericSliderDirection(9, 10)).toBe('right');
		expect(getNumericSliderDirection(11, 10)).toBe('left');
		expect(getNumericSliderDirection(10, 10)).toBeNull();
	});
});
