export type NumericSliderSettings = {
	min: number;
	max: number;
	step: number;
	errorMargin: number;
	initialValue: number;
	precision: number;
};

type NumericSchema = {
	minimum?: unknown;
	maximum?: unknown;
	multipleOf?: unknown;
};

const DIFFICULTY_INTERVALS = [24, 36, 52, 72] as const;
const DIFFICULTY_MARGIN_STEPS = [3, 2, 1, 0.5] as const;

export function createNumericSliderSettings(
	target: number,
	difficulty: number | null,
	schema: unknown,
	random: () => number = Math.random
): NumericSliderSettings | null {
	if (!Number.isFinite(target)) return null;

	const numericSchema = isRecord(schema) ? (schema as NumericSchema) : {};
	const schemaMin = finiteNumber(numericSchema.minimum);
	const schemaMax = finiteNumber(numericSchema.maximum);
	const minBound = schemaMin !== null && schemaMin <= target ? schemaMin : null;
	const maxBound = schemaMax !== null && schemaMax >= target ? schemaMax : null;
	if (minBound === target && maxBound === target) return null;

	const level = Math.min(3, Math.max(0, Math.round(difficulty ?? 1)));
	const intervalCount = DIFFICULTY_INTERVALS[level];
	const targetQuantum = 10 ** -decimalPlaces(target);
	const desiredSpan = Math.max(Math.abs(target) * 0.4, targetQuantum * intervalCount);
	const schemaStep = positiveFiniteNumber(numericSchema.multipleOf);
	let step = schemaStep ?? niceStep(desiredSpan / intervalCount);

	const boundedSpan =
		minBound !== null && maxBound !== null ? Math.max(0, maxBound - minBound) : null;
	if (schemaStep === null && boundedSpan !== null && boundedSpan > 0 && step > boundedSpan / 4) {
		step = niceStep(boundedSpan / intervalCount);
	}

	const lowerCapacity =
		minBound === null ? Number.POSITIVE_INFINITY : Math.floor((target - minBound) / step + 1e-9);
	const upperCapacity =
		maxBound === null ? Number.POSITIVE_INFINITY : Math.floor((maxBound - target) / step + 1e-9);
	const lowerShare = 0.3 + clampRandom(random()) * 0.4;
	let lowerIntervals = Math.max(1, Math.round(intervalCount * lowerShare));
	let upperIntervals = Math.max(1, intervalCount - lowerIntervals);

	if (Number.isFinite(lowerCapacity)) lowerIntervals = Math.min(lowerIntervals, lowerCapacity);
	if (Number.isFinite(upperCapacity)) upperIntervals = Math.min(upperIntervals, upperCapacity);

	let missingIntervals = intervalCount - lowerIntervals - upperIntervals;
	if (missingIntervals > 0) {
		const extraLower = Number.isFinite(lowerCapacity)
			? Math.min(missingIntervals, Math.max(0, lowerCapacity - lowerIntervals))
			: missingIntervals;
		lowerIntervals += extraLower;
		missingIntervals -= extraLower;
		const extraUpper = Number.isFinite(upperCapacity)
			? Math.min(missingIntervals, Math.max(0, upperCapacity - upperIntervals))
			: missingIntervals;
		upperIntervals += extraUpper;
	}

	if (lowerIntervals + upperIntervals < 1) return null;

	const precision = Math.min(12, Math.max(decimalPlaces(target), decimalPlaces(step)) + 2);
	const min = round(target - lowerIntervals * step, precision);
	const max = round(target + upperIntervals * step, precision);
	const span = max - min;
	if (!(span > 0) || !(step > 0)) return null;
	const errorMargin = Math.min(step * DIFFICULTY_MARGIN_STEPS[level], span * 0.1);

	return {
		min,
		max,
		step,
		errorMargin,
		initialValue: min,
		precision
	};
}

export function isNumericSliderAnswerCorrect(
	value: number,
	target: number,
	settings: NumericSliderSettings
) {
	return Math.abs(value - target) <= settings.errorMargin + Number.EPSILON * Math.abs(target) * 4;
}

export function getNumericSliderDirection(value: number, target: number) {
	if (value === target) return null;
	return value < target ? ('right' as const) : ('left' as const);
}

export function formatSliderValue(value: number, precision: number, locale?: string) {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: Math.min(12, precision)
	}).format(value);
}

function niceStep(value: number) {
	if (!(value > 0) || !Number.isFinite(value)) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
	return nice * magnitude;
}

function decimalPlaces(value: number) {
	if (!Number.isFinite(value)) return 0;
	const text = value.toString().toLowerCase();
	const [coefficient, exponentText] = text.split('e');
	const exponent = Number(exponentText ?? 0);
	const decimals = coefficient?.split('.')[1]?.length ?? 0;
	return Math.max(0, decimals - exponent);
}

function finiteNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveFiniteNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampRandom(value: number) {
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function round(value: number, precision: number) {
	return Number(value.toFixed(precision));
}
