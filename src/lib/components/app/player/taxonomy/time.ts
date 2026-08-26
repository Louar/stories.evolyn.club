export function formatTime(ms: number, includeMs = false): string {
	const minutes = Math.floor(ms / 60_000)
		.toString()
		.padStart(2, '0');
	const seconds = Math.floor((ms / 1000) % 60)
		.toString()
		.padStart(2, '0');
	const milliseconds = Math.floor(ms % 1000)
		.toString()
		.padStart(3, '0');

	return includeMs ? `${minutes}:${seconds}.${milliseconds}` : `${minutes}:${seconds}`;
}
