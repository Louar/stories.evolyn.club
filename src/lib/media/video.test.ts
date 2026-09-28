import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

it('gives YouTube a disposable mount rather than the framework-owned container', async () => {
	const mount = {};
	const container = { replaceChildren: vi.fn() };
	const player = {};
	const Player = vi.fn(function () {
		return player;
	});
	vi.stubGlobal('window', {
		location: { origin: 'http://localhost:5174' },
		YT: { Player }
	});
	vi.stubGlobal('document', {
		querySelector: vi.fn(() => ({})),
		createElement: vi.fn(() => mount)
	});
	const { createYouTubePlayer } = await import('./video');
	const result = await createYouTubePlayer(
		container as unknown as HTMLElement,
		'https://www.youtube.com/shorts/HZG50cFJNNQ',
		{
			end: 6,
			onReady: vi.fn(),
			onStateChange: vi.fn(),
			onError: vi.fn()
		}
	);

	expect(container.replaceChildren).toHaveBeenCalledWith(mount);
	expect(Player).toHaveBeenCalledWith(
		mount,
		expect.objectContaining({
			videoId: 'HZG50cFJNNQ',
			playerVars: expect.objectContaining({ origin: 'http://localhost:5174', end: 6 })
		})
	);
	expect(result).toBe(player);
});
