import { describe, expect, it } from 'vitest';
import { webMotionConfigSchema } from './animation';

const config = {
	version: 1,
	composition: { viewBoxWidth: 1080, viewBoxHeight: 1920, fps: 60, durationInFrames: 300 },
	layers: []
};

describe('WebMotionConfig v1 logical viewbox', () => {
	it.each([
		[1920, 1080],
		[1280, 720],
		[1080, 1920],
		[1000, 1000],
		[1, 1]
	])('preserves logical dimensions %s x %s', (viewBoxWidth, viewBoxHeight) => {
		const parsed = webMotionConfigSchema.parse({
			...config,
			composition: { ...config.composition, viewBoxWidth, viewBoxHeight }
		});
		expect(parsed.version).toBe(1);
		expect(parsed.composition).toMatchObject({ viewBoxWidth, viewBoxHeight });
	});

	describe.each(['viewBoxWidth', 'viewBoxHeight'])('%s', (dimension) => {
		it.each([0, -1, 1.5, Infinity, -Infinity, NaN, undefined, null, '1920'])(
			'rejects invalid dimension %s',
			(value) => {
				expect(
					webMotionConfigSchema.safeParse({
						...config,
						composition: { ...config.composition, [dimension]: value }
					}).success
				).toBe(false);
			}
		);
	});

	it.each([{ aspectRatio: '16:9' }, { width: 1920, height: 1080 }])(
		'rejects obsolete composition attributes %j even with valid viewbox dimensions',
		(obsolete) => {
			expect(
				webMotionConfigSchema.safeParse({
					...config,
					composition: { ...config.composition, ...obsolete }
				}).success
			).toBe(false);
		}
	);

	it.each([{ aspectRatio: '16:9' }, { width: 1920, height: 1080 }])(
		'rejects obsolete configurations without viewbox dimensions %j',
		(obsolete) => {
			expect(
				webMotionConfigSchema.safeParse({
					...config,
					composition: { fps: 30, durationInFrames: 150, ...obsolete }
				}).success
			).toBe(false);
		}
	);

	it('requires both viewbox dimensions', () => {
		expect(
			webMotionConfigSchema.safeParse({
				...config,
				composition: { fps: 30, durationInFrames: 150 }
			}).success
		).toBe(false);
	});

	it('still accepts layer dimensions', () => {
		expect(
			webMotionConfigSchema.safeParse({
				...config,
				layers: [
					{ type: 'rectangle', props: { width: 200.5, height: 100 } },
					{
						type: 'svg',
						props: {
							width: 200,
							height: 100,
							viewBox: [0, 0, 20, 10],
							paths: [{ d: 'M0 0L20 10' }]
						}
					}
				]
			}).success
		).toBe(true);
	});
});
