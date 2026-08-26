export type VideoSourceType = 'hls' | 'native' | 'youtube' | 'unsupported';

export type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export type YouTubePlayer = {
	destroy: () => void;
	getCurrentTime: () => number;
	getDuration: () => number;
	getIframe: () => HTMLIFrameElement;
	pauseVideo: () => void;
	playVideo: () => void;
	seekTo: (seconds: number, allowSeekAhead: boolean) => void;
	setPlaybackRate: (rate: number) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer };
type YouTubeStateEvent = YouTubePlayerEvent & { data: YouTubePlayerState };
type YouTubeErrorEvent = YouTubePlayerEvent & { data: number };

type YouTubeNamespace = {
	Player: new (
		element: HTMLElement,
		options: {
			videoId: string;
			host: string;
			playerVars: Record<string, number | string>;
			events: {
				onReady: (event: YouTubePlayerEvent) => void;
				onStateChange: (event: YouTubeStateEvent) => void;
				onError: (event: YouTubeErrorEvent) => void;
			};
		}
	) => YouTubePlayer;
};

type YouTubeWindow = Window & {
	YT?: YouTubeNamespace;
	onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<YouTubeNamespace> | undefined;

const parseUrl = (src: string) => {
	try {
		return src.startsWith('/') ? new URL(src, 'http://localhost') : new URL(src);
	} catch {
		return null;
	}
};

const isYouTubeHost = (hostname: string) => {
	const host = hostname.toLowerCase().replace(/^www\./, '');
	return (
		host === 'youtu.be' ||
		host === 'youtube.com' ||
		host.endsWith('.youtube.com') ||
		host === 'youtube-nocookie.com' ||
		host.endsWith('.youtube-nocookie.com')
	);
};

export const getYouTubeVideoId = (src: string) => {
	const url = parseUrl(src);
	if (!url || !isYouTubeHost(url.hostname)) return null;

	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	const pathParts = url.pathname.split('/').filter(Boolean);
	const candidate =
		host === 'youtu.be'
			? pathParts[0]
			: (url.searchParams.get('v') ??
				(['embed', 'shorts', 'live'].includes(pathParts[0] ?? '') ? pathParts[1] : null));

	return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null;
};

export const getVideoSourceType = (src: string): VideoSourceType => {
	const url = parseUrl(src);
	if (!url) return 'unsupported';
	if (getYouTubeVideoId(src)) return 'youtube';
	if (isYouTubeHost(url.hostname)) return 'unsupported';
	if (url.pathname.toLowerCase().endsWith('.m3u8')) return 'hls';
	return 'native';
};

export const loadYouTubeIframeApi = () => {
	if (youtubeApiPromise) return youtubeApiPromise;

	youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
		const youtubeWindow = window as YouTubeWindow;
		if (youtubeWindow.YT?.Player) {
			resolve(youtubeWindow.YT);
			return;
		}

		const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
		youtubeWindow.onYouTubeIframeAPIReady = () => {
			previousReady?.();
			if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT);
			else reject(new Error('The YouTube iframe API did not initialize.'));
		};

		const existingScript = document.querySelector<HTMLScriptElement>(
			'script[src="https://www.youtube.com/iframe_api"]'
		);
		if (existingScript) return;

		const script = document.createElement('script');
		script.src = 'https://www.youtube.com/iframe_api';
		script.async = true;
		script.onerror = () => reject(new Error('The YouTube iframe API could not be loaded.'));
		document.head.appendChild(script);
	});

	return youtubeApiPromise;
};

export const createYouTubePlayer = async (
	element: HTMLElement,
	src: string,
	options: {
		start?: number;
		onReady: (player: YouTubePlayer) => void;
		onStateChange: (state: YouTubePlayerState) => void;
		onError: () => void;
	}
) => {
	const videoId = getYouTubeVideoId(src);
	if (!videoId) throw new Error('Invalid YouTube URL.');

	const YT = await loadYouTubeIframeApi();
	return new YT.Player(element, {
		videoId,
		host: 'https://www.youtube-nocookie.com',
		playerVars: {
			autoplay: 0,
			controls: 0,
			disablekb: 1,
			enablejsapi: 1,
			playsinline: 1,
			rel: 0,
			...(options.start && options.start > 0 ? { start: options.start } : {})
		},
		events: {
			onReady: ({ target }) => options.onReady(target),
			onStateChange: ({ data }) => options.onStateChange(data),
			onError: () => options.onError()
		}
	});
};
