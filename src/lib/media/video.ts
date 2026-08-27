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
let didWarmYouTubeConnections = false;

const hiddenYouTubePlayerVars = {
	controls: 0,
	disablekb: 1,
	fs: 0,
	iv_load_policy: 3,
	modestbranding: 1,
	playsinline: 1,
	rel: 0,
	cc_load_policy: 3
};

const addPreconnect = (href: string) => {
	if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;

	const link = document.createElement('link');
	link.rel = 'preconnect';
	link.href = href;
	document.head.appendChild(link);
};

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

export const getRoundedVideoTime = (value: number | undefined, duration: number | undefined) => {
	if (typeof value !== 'number' || typeof duration !== 'number' || !Number.isFinite(duration)) {
		return undefined;
	}

	return Math.round(value * duration);
};

export const getYouTubeAlignedValue = (value: number, duration: number | undefined) => {
	if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return value;
	return Math.round(value * duration) / duration;
};

export const getYouTubeThumbnailUrl = (src: string) => {
	const videoId = getYouTubeVideoId(src);
	return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
};

export const warmYouTubeConnections = () => {
	if (didWarmYouTubeConnections) return;

	addPreconnect('https://www.youtube-nocookie.com');
	addPreconnect('https://www.google.com');
	addPreconnect('https://googleads.g.doubleclick.net');
	addPreconnect('https://static.doubleclick.net');
	didWarmYouTubeConnections = true;
};

export const getYouTubeEmbedUrl = (
	src: string,
	timing: { start?: number; end?: number; duration?: number } = {}
) => {
	const videoId = getYouTubeVideoId(src);
	if (!videoId) return src;

	const originalUrl = parseUrl(src);
	const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
	originalUrl?.searchParams.forEach((value, key) => {
		if (key !== 'v') url.searchParams.set(key, value);
	});
	for (const [key, value] of Object.entries(hiddenYouTubePlayerVars)) {
		url.searchParams.set(key, String(value));
	}

	const start = getRoundedVideoTime(timing.start, timing.duration) ?? timing.start;
	const end = getRoundedVideoTime(timing.end, timing.duration) ?? timing.end;

	if (typeof start === 'number' && Number.isFinite(start) && start > 0) {
		url.searchParams.set('start', String(Math.round(start)));
	}
	if (typeof end === 'number' && Number.isFinite(end) && end > 0) {
		url.searchParams.set('end', String(Math.round(end)));
	}

	return url.toString();
};

export const loadYouTubeIframeApi = () => {
	if (youtubeApiPromise) return youtubeApiPromise;
	warmYouTubeConnections();

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
		end?: number;
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
			enablejsapi: 1,
			origin: window.location.origin,
			...hiddenYouTubePlayerVars,
			...(options.start && options.start > 0 ? { start: Math.round(options.start) } : {}),
			...(options.end && options.end > 0 ? { end: Math.round(options.end) } : {})
		},
		events: {
			onReady: ({ target }) => options.onReady(target),
			onStateChange: ({ data }) => options.onStateChange(data),
			onError: () => options.onError()
		}
	});
};
