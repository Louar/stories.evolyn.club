import { onDestroy } from 'svelte';

type Options = {
	delayMs: number;
	timeoutMs: number;
};

export function useSubmissionState({ delayMs = 500, timeoutMs = 8000 }: Partial<Options> = {}) {
	let submitting = $state(false);
	let delayed = $state(false);
	let timeout = $state(false);
	let submissionId = 0;
	let delayTimer: ReturnType<typeof setTimeout> | undefined;
	let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

	const clearTimers = () => {
		if (delayTimer !== undefined) clearTimeout(delayTimer);
		if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
		delayTimer = undefined;
		timeoutTimer = undefined;
	};

	const finish = (id: number) => {
		if (id !== submissionId) return;
		clearTimers();
		submitting = false;
		delayed = false;
		timeout = false;
	};

	const start = () => {
		clearTimers();
		const id = ++submissionId;
		submitting = true;
		delayed = false;
		timeout = false;

		delayTimer = setTimeout(() => {
			if (id === submissionId && submitting) delayed = true;
		}, delayMs);
		timeoutTimer = setTimeout(() => {
			if (id === submissionId && submitting) timeout = true;
		}, timeoutMs);

		return id;
	};

	onDestroy(() => {
		submissionId++;
		clearTimers();
	});

	return {
		get submitting() {
			return submitting;
		},
		get delayed() {
			return delayed;
		},
		get timeout() {
			return timeout;
		},
		start,
		finish
	};
}
