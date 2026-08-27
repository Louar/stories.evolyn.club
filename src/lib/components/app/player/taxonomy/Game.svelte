<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { AttributeType } from '$lib/db/schemas/2-story-module';
	import * as turf from '@turf/turf';
	import { onMount, untrack } from 'svelte';
	import { quartOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';
	import Map from './Map.svelte';
	import RoundFeedback from './RoundFeedback.svelte';
	import SortableBoard from './SortableBoard.svelte';
	import { createPlayableMap } from './map';
	import type { CategoryMap, GuessResult, MapItem, ShapeArcs, TopoGeometry } from './map-types';
	import { formatTime } from './time';
	import type { GamePerformance, SortableRoundItem, TaxonomyRound } from './types';

	type SortableRound = NonNullable<ReturnType<typeof toSortableRound>>;
	type MapRound = NonNullable<ReturnType<typeof toMapRound>>;
	type GameRound = SortableRound | MapRound;
	type Feedback = {
		correct: boolean;
		correctPositions?: boolean[] | null;
		title?: string;
		description?: string;
	};

	let {
		rounds,
		goal,
		maxMistakes,
		showHints = false,
		oncomplete
	}: {
		rounds: TaxonomyRound[];
		goal: number;
		maxMistakes: number | null;
		showHints?: boolean;
		oncomplete: (performance: GamePerformance) => void;
	} = $props();

	const playableRounds = untrack(() => rounds)
		.map(toGameRound)
		.filter(isGameRound);
	let currentRoundIndex = $state(0);
	let items = $state<SortableRoundItem[]>(
		playableRounds[0]?.kind === 'sortable' ? [...playableRounds[0].items] : []
	);
	let completed = $state(0);
	let mistakes = $state(0);
	let feedback = $state<Feedback | null>(null);
	let mapWidth = $state(1);
	let mapHeight = $state(1);
	let foundFeatures = $state<TopoGeometry[]>([]);
	let arrowRotation = $state<number | undefined>();
	let timeMs = $state(0);
	let startedAt = 0;
	let intervalId: ReturnType<typeof setInterval> | undefined;
	let feedbackTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let feedbackTimeoutToken = 0;
	let didComplete = false;
	const currentRound = $derived(playableRounds[currentRoundIndex] ?? null);
	const hintFeatures = $derived(
		showHints && currentRound?.kind === 'map' ? [currentRound.targetGeometry] : []
	);
	const finished = $derived(currentRoundIndex >= playableRounds.length);

	onMount(() => {
		startedAt = Date.now();
		intervalId = setInterval(() => {
			if (!finished) timeMs = Date.now() - startedAt;
		}, 250);

		if (playableRounds.length === 0) completeGame();

		return () => {
			if (intervalId) clearInterval(intervalId);
			clearFeedbackTimeout();
		};
	});

	function observeSize(node: HTMLElement) {
		const resizeObserver = new ResizeObserver(([entry]) => {
			if (!entry) return;
			mapWidth = Math.max(1, entry.contentRect.width);
			mapHeight = Math.max(1, entry.contentRect.height);
		});
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	}

	function clearFeedbackTimeout() {
		feedbackTimeoutToken += 1;
		if (!feedbackTimeoutId) return;
		clearTimeout(feedbackTimeoutId);
		feedbackTimeoutId = undefined;
	}

	function showFeedback(nextFeedback: Feedback) {
		clearFeedbackTimeout();
		feedback = nextFeedback;
		const timeoutToken = feedbackTimeoutToken;
		feedbackTimeoutId = setTimeout(() => {
			if (timeoutToken !== feedbackTimeoutToken) return;
			feedbackTimeoutId = undefined;
			if (nextFeedback.correct) nextRound();
			else feedback = null;
		}, 3000);
	}

	function numericValue(value: unknown) {
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && value.trim() !== '') {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	}

	function toSortableRound(round: TaxonomyRound) {
		if (round.attribute.type !== AttributeType.number) return null;
		const sortableItems = round.items.map((item) => {
			const sortValue = numericValue(item.value);
			if (sortValue === null || typeof item.name !== 'string') return null;
			return { id: item.id, name: item.name, sortValue };
		});
		if (sortableItems.some((item) => item === null)) return null;

		return {
			kind: 'sortable' as const,
			category: round.category,
			attribute: round.attribute,
			items: sortableItems as SortableRoundItem[]
		};
	}

	function toMapRound(round: TaxonomyRound) {
		if (round.attribute.type === AttributeType.number) return null;
		const mapItems = round.mapItems.map(toMapItem).filter(isMapItem);
		const map = round.map ? createPlayableMap(round.map as CategoryMap, mapItems) : null;
		if (!map) return null;

		const target = round.items.find((item) => {
			const targetItemId = getMapTargetItemId(round.attribute.type, item);
			return map.geometries.some((geometry) => geometry.properties.id === targetItemId);
		});
		if (!target || typeof target.name !== 'string') return null;

		const targetItemId = getMapTargetItemId(round.attribute.type, target);
		if (!targetItemId) return null;
		const targetGeometry = map.geometries.find(
			(geometry) => geometry.properties.id === targetItemId
		);
		if (!targetGeometry) return null;

		return {
			kind: 'map' as const,
			category: round.category,
			attribute: round.attribute,
			map,
			targetGeometry,
			target: {
				id: target.id,
				name: target.name,
				referencedItemId: targetItemId,
				referencedName: targetGeometry.properties.name
			}
		};
	}

	function getMapTargetItemId(
		attributeType: TaxonomyRound['attribute']['type'],
		item: TaxonomyRound['items'][number]
	) {
		return attributeType === AttributeType.itemReference ? item.referencedItemId : item.id;
	}

	function toMapItem(item: TaxonomyRound['mapItems'][number]): MapItem | null {
		if (typeof item.id !== 'string' || typeof item.name !== 'string' || !isShapeArcs(item.shape)) {
			return null;
		}
		return {
			color: typeof item.color === 'string' ? item.color : null,
			id: item.id,
			name: item.name,
			shape: item.shape,
			center: isCenter(item.center) ? item.center : null
		};
	}

	function isMapItem(item: MapItem | null): item is MapItem {
		return item !== null;
	}

	function isShapeArcs(value: unknown): value is ShapeArcs {
		return Array.isArray(value) && value.length > 0;
	}

	function isCenter(value: unknown): value is [number, number] {
		return (
			Array.isArray(value) &&
			value.length === 2 &&
			value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
		);
	}

	function toGameRound(round: TaxonomyRound) {
		return toSortableRound(round) ?? toMapRound(round);
	}

	function isGameRound(round: ReturnType<typeof toGameRound>): round is GameRound {
		return round !== null;
	}

	function submitOrder() {
		const correctOrder = [...items].sort((a, b) => a.sortValue - b.sortValue);
		const correctPositions = items.map((item, index) => item.id === correctOrder[index]?.id);
		const correct = correctPositions.every(Boolean);
		showFeedback({ correct, correctPositions });
		if (correct) completed += 1;
		else mistakes += 1;
	}

	function nextRound() {
		clearFeedbackTimeout();
		currentRoundIndex += 1;
		feedback = null;
		foundFeatures = [];
		arrowRotation = undefined;
		const next = playableRounds[currentRoundIndex];
		items = next?.kind === 'sortable' ? [...next.items] : [];
		if (currentRoundIndex >= playableRounds.length) completeGame();
	}

	function completeGame() {
		if (didComplete) return;
		didComplete = true;
		timeMs = Math.max(0, Date.now() - startedAt);
		if (intervalId) clearInterval(intervalId);
		oncomplete({
			nrOfRounds: playableRounds.length,
			score: completed,
			mistakes,
			duration: timeMs
		});
	}

	function clickMapFeature(feature: TopoGeometry): GuessResult {
		if (!currentRound || currentRound.kind !== 'map' || feedback?.correct) {
			return 'already_guessed';
		}
		const correct = feature.properties.id === currentRound.target.referencedItemId;
		if (correct) {
			completed += 1;
			foundFeatures = [feature];
			arrowRotation = undefined;
			showFeedback({
				correct: true,
				title: 'Correct location!',
				description: `${currentRound.target.name} matches ${currentRound.target.referencedName}.`
			});
			return 'correct';
		}

		mistakes += 1;
		triggerDirectionIndicator(feature);
		showFeedback({
			correct: false,
			title: 'Not that part of the map.',
			description: 'Try another location on the map.'
		});
		return 'wrong';
	}

	function triggerDirectionIndicator(feature: TopoGeometry) {
		if (!currentRound || currentRound.kind !== 'map') return;
		const targetFeature = currentRound.map.geometries.find(
			(geometry) => geometry.properties.id === currentRound.target.referencedItemId
		);
		if (!targetFeature?.properties.center || !feature.properties.center) return;
		const bearing = turf.bearingToAzimuth(
			turf.rhumbBearing(
				feature.properties.center.geometry.coordinates,
				targetFeature.properties.center.geometry.coordinates
			)
		);
		arrowRotation = [360, 45, 90, 135, 180, 225, 270, 315][Math.round(bearing / 45) % 8];
	}

	function countryFocusedHandler() {}
</script>

<div
	{@attach observeSize}
	class="absolute inset-0 overflow-hidden text-game-text"
	data-taxonomy-game
>
	{#if feedback}
		{#key feedback}
			<section
				class="pointer-events-none absolute top-0 left-1/2 z-4 flex w-[min(100%-1rem,38rem)] -translate-x-1/2 flex-col gap-2 px-2 pt-3"
				aria-label="Submission result"
				in:fly={{ y: -80, duration: 220 }}
				out:fly={{ y: -80, duration: 180 }}
			>
				<div class="pointer-events-auto">
					<RoundFeedback
						correct={feedback.correct}
						title={feedback.title}
						description={feedback.description}
					>
						{#if feedback.correct}
							<Button type="button" size="lg" class="w-full text-lg font-black" onclick={nextRound}>
								{currentRoundIndex === playableRounds.length - 1 ? 'Show results' : 'Next round'}
							</Button>
						{/if}
					</RoundFeedback>
				</div>
			</section>
		{/key}
	{/if}

	{#if playableRounds.length === 0}
		<section
			class="absolute top-1/2 left-1/2 z-2 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-game-danger bg-game-panel p-5 text-center shadow-panel"
			role="alert"
		>
			<h2 class="text-2xl font-black">No playable rounds available</h2>
			<p class="mt-2 text-game-text-muted">
				This game needs number attributes or map references with valid shapes.
			</p>
		</section>
	{:else if finished}
		<section
			class="absolute top-1/2 left-1/2 z-2 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-game-border bg-game-panel p-5 text-center shadow-panel"
			aria-live="polite"
		>
			<p class="text-sm font-bold tracking-wide text-game-text-muted uppercase">Game complete</p>
			<h2 class="mt-2 text-3xl font-black">{completed} of {playableRounds.length} correct</h2>
			<p class="mt-2 text-game-text-muted">Mistakes: {mistakes}</p>
		</section>
	{:else if currentRound}
		{#if currentRound.kind === 'map'}
			<div class="absolute inset-0" in:fly={{ y: 20, duration: 500 }}>
				<Map
					map={currentRound.map}
					width={mapWidth}
					height={mapHeight}
					{foundFeatures}
					{hintFeatures}
					unfoundFeatures={currentRound.map.geometries}
					clickCountryHandler={clickMapFeature}
					{countryFocusedHandler}
				/>
			</div>
		{:else}
			<section
				class="absolute inset-0 z-1 m-auto h-fit max-h-dvh w-full max-w-md scrollbar-none overflow-y-auto overscroll-contain mask-[linear-gradient(to_bottom,transparent,black_8rem,black_calc(100%-2rem),transparent)] px-4 pt-44 pb-8 sm:max-w-lg sm:px-5"
			>
				<SortableBoard
					bind:items
					correctPositions={feedback?.correctPositions ?? null}
					disabled={feedback?.correct ?? false}
					{showHints}
				/>
			</section>
		{/if}

		<section
			class="pointer-events-none absolute top-6 left-1/2 z-2 flex w-[min(100%-6.5rem,44rem)] -translate-x-1/2 flex-col items-center gap-5 max-[760px]:top-22 max-[760px]:w-[calc(100%-1rem)]"
			aria-label="Game status"
			in:fly={{ y: -100, duration: 250, delay: 50 }}
		>
			<div
				class="z-1 flex flex-wrap items-center justify-center gap-2 rounded-md border border-game-border bg-game-panel/95 px-2.5 py-2 shadow-panel backdrop-blur"
			>
				{#if playableRounds.length !== goal}
					<span
						aria-label={`Round ${currentRoundIndex + 1} of ${playableRounds.length}`}
						class="rounded-md px-1.5 py-0.5 font-extrabold"
					>
						Round {#key currentRoundIndex}<span in:scale={{ start: 1.5 }}
								>{currentRoundIndex + 1}</span
							>{/key} / {playableRounds.length}
					</span>
				{/if}
				<span
					aria-label={`${completed} of ${goal} completed`}
					class="rounded-md px-1.5 py-0.5 font-extrabold"
				>
					Score {#key completed}<span in:scale={{ start: 1.5 }}>{completed}</span>{/key} / {goal}
				</span>
				<span
					class="rounded-md px-1.5 py-0.5 font-extrabold text-game-danger"
					aria-label={`${mistakes} mistakes`}
				>
					Mistakes {#key mistakes}<span in:scale={{ start: 1.5 }}>{mistakes}</span
						>{/key}{#if maxMistakes !== null}
						/ {maxMistakes}{/if}
				</span>
				<span
					class="rounded-md px-1.5 py-0.5 font-extrabold"
					aria-label={`Time ${formatTime(timeMs)}`}>Time {formatTime(timeMs)}</span
				>
			</div>
			<div class="flex justify-center" in:fly={{ y: -100, duration: 500, delay: 75 }}>
				{#key currentRoundIndex}
					<div
						in:fly={{ y: 20 }}
						class="flex items-center justify-center rounded-md border border-game-border bg-game-inverse px-4 py-2 text-center text-game-inverse-text shadow-panel"
					>
						<div>
							{#if currentRound.kind !== 'sortable'}<p class="mt-1 text-sm">
									What is the {currentRound.attribute.name ?? 'location'} of:
								</p>{/if}
							<h1 class="font-serif text-[clamp(1.7rem,3.6vw,3.5rem)] leading-none font-black">
								{currentRound.kind === 'sortable'
									? `Sort by ${currentRound.attribute.name ?? 'value'}`
									: currentRound.target.name}
							</h1>
						</div>
					</div>
				{/key}
			</div>
			{#if currentRound.kind === 'sortable' && !feedback?.correct}
				<div
					class="pointer-events-auto flex w-[min(100%,24rem)] justify-center"
					in:fly={{ y: -18, duration: 220, delay: 100 }}
				>
					<Button type="button" size="lg" class="w-full text-lg font-black" onclick={submitOrder}
						>Submit order</Button
					>
				</div>
			{/if}
			{#if arrowRotation !== undefined}
				<div
					class="pointer-events-none absolute top-[calc(100%+0.75rem)] left-1/2 grid size-18 -translate-x-1/2 place-items-center rounded-full border-8 border-background bg-game-inverse text-4xl font-black text-game-inverse-text shadow-arrow"
					aria-label="Direction hint"
					in:fly={{ y: -80, duration: 200 }}
					out:fly={{ y: 20, duration: 500, easing: quartOut }}
				>
					<span
						class="grid size-full place-items-center leading-none transition-transform duration-150"
						style={`transform: rotate(${arrowRotation}deg)`}>↑</span
					>
				</div>
			{/if}
		</section>
	{/if}
</div>
