<script lang="ts">
	import WebMotionPlayer, { type WebMotionConfig } from './WebMotionPlayer.svelte';

	const animation: WebMotionConfig = {
		version: 1,
		composition: {
			viewBoxWidth: 1280,
			viewBoxHeight: 720,
			fps: 30,
			durationInFrames: 300,
			background: '#09090b'
		},
		playback: {
			loop: true
		},
		motions: {
			fadeIn30: {
				duration: 30,
				easing: 'easeOutCubic',
				animate: {
					opacity: [0, 1]
				}
			},
			fadeIn24: {
				duration: 24,
				easing: 'easeOutCubic',
				animate: {
					opacity: [0, 1]
				}
			},
			fadeUp: {
				duration: 30,
				easing: 'easeOutCubic',
				animate: {
					opacity: [0, 1],
					y: {
						values: [33, 0],
						relative: true
					}
				}
			}
		},
		layers: [
			{
				type: 'circle',
				name: 'Drifting glow',
				props: {
					x: 120,
					y: 360,
					radius: 210,
					fill: 'rgba(79, 70, 229, 0.32)',
					blur: 48
				},
				animate: {
					x: {
						values: [120, 1160, 120],
						easing: 'easeInOutCubic'
					},
					radius: {
						values: [210, 270, 210, 270, 210],
						easing: 'easeInOutSine'
					},
					blur: {
						values: [48, 96, 48],
						easing: 'easeInOutSine'
					},
					fill: {
						values: [
							'rgba(79, 70, 229, 0.32)',
							'rgba(236, 72, 153, 0.38)',
							'rgba(79, 70, 229, 0.32)'
						],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'rectangle',
				name: 'Rotating card',
				from: 10,
				motion: 'fadeIn30',
				props: {
					x: 640,
					y: 360,
					width: 620,
					height: 280,
					cornerRadius: 52,
					fill: 'rgba(24, 24, 27, 0.82)',
					stroke: 'rgba(165, 180, 252, 0.3)',
					lineWidth: 2,
					opacity: 0,
					blur: 2
				},
				animate: {
					rotation: {
						values: [-3, 3, -3],
						easing: 'easeInOutSine'
					},
					stroke: {
						values: ['rgba(165, 180, 252, 0.3)', '#f5d0fe', 'rgba(165, 180, 252, 0.3)'],
						easing: 'easeInOutSine'
					},
					blur: {
						values: [2, 12, 2],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'ellipse',
				name: 'Accent ellipse',
				props: {
					x: 333,
					y: 206,
					radiusX: 80,
					radiusY: 28,
					rotation: -18,
					fill: '#818cf8',
					opacity: 0.75,
					blur: 8
				},
				animate: {
					scaleX: {
						values: [0.75, 1.15, 0.75, 1.15, 0.75],
						easing: 'easeInOutSine'
					},
					blur: {
						values: [8, 32, 8],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'polygon',
				name: 'Triangle',
				props: {
					x: 930,
					y: 514,
					points: [
						[0, -48],
						[44, 34],
						[-44, 34]
					],
					fill: '#c4b5fd',
					opacity: 0.72,
					blur: 2
				},
				animate: {
					rotation: {
						values: [0, 360],
						easing: 'linear'
					},
					blur: {
						values: [2, 14, 2],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'line',
				name: 'Underline',
				from: 25,
				props: {
					x: 640,
					y: 434,
					x1: -135,
					y1: 0,
					x2: 135,
					y2: 0,
					stroke: '#818cf8',
					lineWidth: 5,
					lineCap: 'round',
					scaleX: 0,
					blur: 1
				},
				animate: {
					scaleX: {
						values: [0, 1],
						duration: 30,
						easing: 'easeOutCubic'
					},
					blur: {
						values: [1, 9, 1],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'svg',
				name: 'Animated sparkle SVG',
				from: 18,
				motion: 'fadeIn24',
				props: {
					x: 920,
					y: 228,
					width: 112,
					height: 112,
					viewBox: [0, 0, 24, 24],
					opacity: 0,
					blur: 2,
					scale: 0.6,
					rotation: -20,
					paths: [
						{
							d: 'M12 2l2.35 6.35L21 10.7l-6.65 2.35L12 20l-2.35-6.95L3 10.7l6.65-2.35L12 2Z',
							fill: '#f5d0fe',
							stroke: '#ffffff',
							lineWidth: 0.45
						}
					]
				},
				animate: {
					rotation: {
						values: [-20, 340],
						easing: 'linear'
					},
					'paths.0.fill': {
						values: ['#f5d0fe', '#fde68a', '#f5d0fe'],
						easing: 'easeInOutSine'
					},
					blur: {
						values: [2, 16, 2],
						easing: 'easeInOutSine'
					},
					scale: {
						values: [0.6, 1.15, 0.8, 1.15, 0.8, 0.6],
						easing: 'easeInOutSine'
					}
				}
			},
			{
				type: 'text',
				name: 'Title',
				from: 12,
				motion: 'fadeUp',
				props: {
					x: 640,
					y: 337,
					text: 'JSON MOTION',
					fontSize: 82,
					fontWeight: 750,
					fontFamily: 'system-ui',
					color: '#fafafa',
					opacity: 0
				}
			},
			{
				type: 'text',
				name: 'Subtitle',
				from: 28,
				motion: 'fadeIn24',
				props: {
					x: 640,
					y: 400,
					text: 'Text · shapes · SVG paths',
					fontSize: 27,
					fontWeight: 450,
					fontFamily: 'system-ui',
					color: '#c7d2fe',
					opacity: 0
				}
			}
		]
	};
</script>

<svelte:head>
	<title>JSON WebMotion player</title>
</svelte:head>

<main
	class="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center gap-8 px-4 py-12 sm:px-8"
>
	<header class="max-w-2xl space-y-3">
		<p class="text-sm font-medium tracking-[0.18em] text-indigo-500 uppercase">JSON runtime</p>
		<h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
			Data-driven WebMotion animations
		</h1>
		<p class="text-base leading-7 text-muted-foreground sm:text-lg">
			A compact JSON document controls the timeline, reusable motions, text, shapes, SVG paths and
			keyframed transforms.
		</p>
	</header>

	<WebMotionPlayer
		config={animation}
		class="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-indigo-950/20"
	/>
</main>
