import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { polygon, point, booleanPointInPolygon, kinks } from '@turf/turf';

// Illustration paths and hit regions share authoring coordinates. Curves are sampled
// only for TopoJSON; the decorative SVG retains its smooth Bezier outlines.
const root = new URL('../', import.meta.url);
const svg = (box, content) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}">${content}</svg>\n`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const ellipse = (x, y, rx, ry, fill, extra = '') =>
	`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const line = (d, color = '#654d3d', width = 1.5) =>
	path(
		d,
		'none',
		`stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`
	);
const group = (transform, content, extra = '') =>
	`<g transform="${transform}" ${extra}>${content}</g>`;
const outline = 'stroke="#604b3e" stroke-width="2" stroke-linejoin="round"';
const shading =
	'<defs><linearGradient id="volume" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="#fff9d9" stop-opacity=".38"/><stop offset=".5" stop-color="#fff9d9" stop-opacity="0"/><stop offset="1" stop-color="#614b3a" stop-opacity=".18"/></linearGradient></defs>';

function ring(d) {
	const tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g);
	const points = [];
	let i = 0,
		current = [0, 0];
	const pair = () => [Number(tokens[i++]), Number(tokens[i++])];
	while (i < tokens.length) {
		const command = tokens[i++];
		if (command === 'M' || command === 'L') {
			current = pair();
			points.push(current);
		} else if (command === 'Q' || command === 'C') {
			const start = current,
				a = pair(),
				b = pair(),
				end = command === 'C' ? pair() : b;
			for (let step = 1; step <= 16; step++) {
				const t = step / 16,
					u = 1 - t;
				current = [0, 1].map((axis) =>
					Number(
						(command === 'Q'
							? u * u * start[axis] + 2 * u * t * a[axis] + t * t * end[axis]
							: u ** 3 * start[axis] +
								3 * u * u * t * a[axis] +
								3 * u * t * t * b[axis] +
								t ** 3 * end[axis]
						).toFixed(3)
					)
				);
				points.push(current);
			}
		} else if (command === 'Z') {
			if (current[0] !== points[0][0] || current[1] !== points[0][1]) points.push([...points[0]]);
		} else throw new Error(`Unsupported path command ${command}`);
	}
	return points;
}

const cattleBody =
	'M 140 270 Q 157 247 202 258 Q 330 247 437 262 L 478 278 Q 491 273 500 256 L 517 258 L 535 279 Q 552 279 558 291 L 575 305 Q 584 320 569 330 L 540 335 L 510 317 L 478 322 L 478 380 L 469 419 L 480 436 L 455 436 L 447 420 L 447 371 Q 351 387 231 371 L 209 390 L 205 425 L 214 437 L 188 437 L 185 419 L 190 365 Q 132 359 134 310 Z';
const pigBody =
	'M 149 581 Q 181 552 253 565 Q 348 549 415 571 Q 455 577 470 600 L 490 604 L 512 615 L 538 616 Q 550 632 540 644 L 511 648 L 483 663 L 461 679 L 450 716 L 461 733 L 437 733 L 424 716 L 427 680 Q 337 704 218 684 L 205 718 L 215 734 L 188 734 L 178 720 L 182 675 Q 130 655 136 617 Z';
const lambBody =
	'M 704 580 Q 732 557 778 567 Q 831 554 874 571 Q 908 580 902 618 L 889 665 L 884 708 L 893 725 L 871 725 L 860 709 L 860 672 Q 790 693 723 666 L 710 704 L 718 720 L 694 720 L 683 706 L 694 658 L 683 634 L 657 631 L 636 613 Q 627 599 639 586 L 657 578 L 675 564 L 688 574 Z';
const chickenBody =
	'M 742 304 Q 734 286 741 268 Q 745 255 739 246 Q 724 234 711 246 Q 700 254 710 269 L 715 294 Q 696 322 710 352 Q 726 376 766 387 L 783 395 L 780 416 L 790 423 L 806 407 L 813 384 Q 850 375 861 345 L 907 316 L 924 282 Q 898 291 879 295 L 897 269 Q 871 277 847 295 Q 799 277 774 288 Z';

const cattleDetails = [
	path('M 182 267 Q 206 261 222 270 L 212 305 Q 195 317 178 302 Z', '#755441'),
	path('M 306 259 Q 337 257 357 264 L 371 294 Q 351 312 326 298 L 316 281 Z', '#755441'),
	path('M 263 344 Q 281 329 304 342 L 317 374 L 270 372 Z', '#89634a'),
	path('M 474 285 Q 486 283 495 272 L 501 296 L 484 310 Z', '#9f7c59'),
	path('M 511 265 Q 488 244 487 252 Q 487 267 506 276 Z', '#d0ac7b', outline),
	path('M 520 259 Q 522 239 531 236 L 528 262 Z', '#ede2c8', outline),
	path('M 545 297 Q 564 291 575 307 Q 581 317 569 326 L 552 328 Z', '#b68b76'),
	ellipse(535, 286, 3, 3.8, '#342b25'),
	ellipse(536, 285, 0.9, 1, '#fff'),
	ellipse(569, 311, 2, 3, '#5f4035'),
	line('M 560 324 Q 565 327 571 323'),
	line('M 142 278 Q 118 283 118 329 L 113 351', '#70513d', 4),
	path('M 114 342 Q 105 356 112 367 Q 125 357 119 346 Z', '#604735'),
	path('M 234 375 Q 233 390 252 392 L 270 384 L 270 376 Z', '#dfb0a0'),
	line('M 244 389 L 243 396 M 258 387 L 258 394', '#ba8e7e', 3),
	path(
		'M 188 427 L 208 427 L 214 437 L 188 437 Z M 455 426 L 472 426 L 480 436 L 455 436 Z',
		'#534c42'
	),
	line('M 155 279 Q 144 298 148 318 M 446 330 Q 453 346 447 363', '#c3a482', 1.5),
	line('M 163 264 Q 197 256 223 264 M 250 261 Q 275 258 294 259', '#f4e2bd', 2),
	line('M 483 299 Q 493 304 502 297 M 525 305 Q 531 312 542 312', '#a88a66'),
	line('M 512 256 Q 508 246 514 242', '#715541', 2)
];
const cattleDetail = cattleDetails.join('');
const pigDetail = [
	path('M 473 608 L 478 572 Q 499 580 501 604 L 491 621 Z', '#d9958a', outline),
	path('M 479 606 L 482 582 L 493 603 Z', '#bd7772'),
	ellipse(538, 631, 11, 13, '#cf8c82', outline),
	ellipse(535, 630, 2, 3, '#83544e'),
	ellipse(543, 630, 2, 3, '#83544e'),
	ellipse(506, 615, 3, 3, '#44352f'),
	ellipse(507, 614, 1, 1, '#fff'),
	line('M 518 642 Q 527 645 532 642'),
	line('M 143 605 C 115 612 115 586 129 590 C 143 595 124 604 120 591', '#aa7062', 3),
	line('M 161 609 Q 177 580 224 581 M 245 577 Q 305 566 354 573', '#f3c9b2', 3),
	path(
		'M 187 723 L 207 723 L 215 734 L 188 734 Z M 437 722 L 454 722 L 461 733 L 437 733 Z',
		'#74625a'
	),
	line('M 200 726 L 200 733 M 449 725 L 449 732'),
	line(
		'M 242 689 L 241 695 M 271 693 L 270 699 M 300 694 L 300 700 M 328 693 L 328 699',
		'#c28d7d',
		2
	)
].join('');
const lambDetail = [
	...Array.from({ length: 9 }, (_, i) =>
		line(
			`M ${711 + i * 19} ${586 + Math.sin(i) * 4} Q ${717 + i * 19} ${573 + Math.sin(i) * 4} ${726 + i * 19} ${585 + Math.sin(i) * 4}`,
			'#c0b497',
			2
		)
	),
	...Array.from({ length: 7 }, (_, i) =>
		line(`M ${725 + i * 21} 632 Q ${735 + i * 21} 620 ${746 + i * 21} 633`, '#c7bca2', 1.6)
	),
	...Array.from({ length: 6 }, (_, i) =>
		line(`M ${737 + i * 24} 610 Q ${747 + i * 24} 599 ${757 + i * 24} 612`, '#d0c6ae', 1.6)
	),
	path('M 654 584 Q 632 566 624 577 Q 631 593 654 597 Z', '#9a8870', outline),
	path('M 671 584 Q 690 566 698 577 Q 690 594 675 597 Z', '#b2a187', outline),
	path('M 639 594 Q 650 588 661 595 L 662 619 Q 648 623 640 612 Z', '#a5947a'),
	ellipse(647, 598, 2.8, 3.2, '#38342e'),
	ellipse(648, 597, 0.8, 1, '#fff'),
	line('M 636 607 L 642 608 M 646 620 Q 651 622 656 619'),
	path(
		'M 695 711 L 713 711 L 718 720 L 694 720 Z M 871 715 L 888 715 L 893 725 L 871 725 Z',
		'#655f51'
	),
	line('M 901 604 Q 919 614 910 636', '#c9b99b', 7)
].join('');
const chickenDetail = [
	path('M 710 246 Q 704 230 713 233 Q 719 222 725 234 Q 734 227 737 242 Z', '#b95744', outline),
	path('M 709 255 L 694 263 L 711 267 Z', '#d6a354', outline),
	path('M 717 271 Q 707 286 721 287 Q 731 284 726 271 Z', '#b95744'),
	ellipse(721, 251, 3, 3, '#38322b'),
	ellipse(722, 250, 1, 1, '#fff'),
	path(
		'M 760 317 C 790 291 837 309 849 327 Q 826 363 785 352 Q 765 341 760 317 Z',
		'#c69b60',
		outline
	),
	line(
		'M 777 324 Q 809 333 839 322 M 779 334 Q 807 343 833 334 M 785 344 Q 806 350 820 345',
		'#8c6d46'
	),
	line('M 856 319 L 904 296 M 861 332 L 911 306 M 852 340 L 895 322', '#a38050', 2),
	line(
		'M 721 302 Q 730 310 741 310 M 717 314 Q 728 323 741 321 M 724 331 Q 734 337 744 334',
		'#c1a072'
	),
	line(
		'M 790 409 L 780 442 L 762 449 M 780 442 L 798 449 M 780 442 L 775 453 M 801 409 L 807 439 L 823 445',
		'#bc8d45',
		4
	),
	line('M 807 439 L 802 448', '#bc8d45', 3)
].join('');

const animals = {
	beef: {
		body: cattleBody,
		detail: cattleDetail,
		fill: '#e3c9a3',
		center: [310, 322],
		id: 'animal.beef-cattle',
		transform: [0.68, -54, 175]
	},
	chicken: {
		body: chickenBody,
		detail: chickenDetail,
		fill: '#f1d9a5',
		center: [789, 340],
		id: 'animal.chicken',
		transform: [0.75, -45, 160]
	},
	pork: {
		body: pigBody,
		detail: pigDetail,
		fill: '#e7b3a0',
		center: [300, 630],
		id: 'animal.pig',
		transform: [0.72, -66, 205]
	},
	lamb: {
		body: lambBody,
		detail: lambDetail,
		fill: '#e6ddc3',
		center: [780, 625],
		id: 'animal.lamb',
		transform: [0.9, -170, 100]
	}
};
const farLegs = {
	beef: 'M 215 361 L 224 387 L 230 419 L 241 432 L 221 432 L 214 417 L 203 366 Z M 422 368 L 430 405 L 439 427 L 421 427 L 412 403 L 410 372 Z',
	pork: 'M 210 672 L 230 680 L 224 715 L 235 726 L 214 726 L 209 716 Z M 407 681 L 421 679 L 416 710 L 428 723 L 407 723 L 401 710 Z',
	lamb: 'M 710 652 L 730 664 L 728 701 L 738 715 L 720 715 L 712 699 Z M 840 668 L 855 669 L 854 704 L 865 720 L 847 720 L 839 703 Z',
	chicken: ''
};
const animalIllustration = (a) =>
	path(farLegs[Object.keys(animals).find((key) => animals[key] === a)], '#b9a589', outline) +
	path(a.body, a.fill, outline) +
	path(a.body, 'url(#volume)') +
	a.detail;

const cuts = [];
const cut = (ref, center, d) => cuts.push({ ref, center, d });
cut(
	'beef.round',
	[168, 300],
	'M 140 270 Q 157 247 202 258 L 202 314 L 184 351 Q 130 346 134 310 Z'
);
cut('beef.rump', [224, 272], 'M 202 258 L 245 256 L 244 290 L 202 287 Z');
cut('beef.top-sirloin', [267, 271], 'M 245 256 L 292 254 L 289 289 L 244 290 Z');
cut('beef.short-loin', [317, 282], 'M 292 254 L 343 255 L 342 320 L 286 315 L 289 289 Z');
cut('beef.tenderloin', [257, 301], 'M 202 287 L 244 290 L 289 289 L 286 315 L 246 313 L 202 307 Z');
cut('beef.bottom-sirloin', [219, 328], 'M 202 307 L 246 313 L 238 344 L 184 351 L 202 314 Z');
cut('beef.ribeye', [372, 291], 'M 343 255 L 401 258 L 400 332 L 342 320 Z');
cut('beef.chuck', [435, 301], 'M 401 258 Q 421 259 437 262 L 464 273 L 461 335 L 400 332 Z');
cut(
	'beef.neck',
	[482, 295],
	'M 464 273 L 478 278 Q 491 273 500 256 L 517 258 L 510 317 L 478 322 L 461 335 Z'
);
cut('beef.flank', [214, 360], 'M 184 351 L 238 344 L 255 373 L 231 371 L 209 390 L 190 365 Z');
cut(
	'beef.plate',
	[294, 348],
	'M 246 313 L 286 315 L 342 320 L 339 379 Q 288 381 255 373 L 238 344 Z'
);
cut('beef.short-ribs', [373, 350], 'M 342 320 L 400 332 L 409 375 L 339 379 Z');
cut('beef.brisket', [439, 351], 'M 400 332 L 461 335 L 478 322 L 478 365 L 447 371 L 409 375 Z');
cut('beef.hind-shank', [198, 411], 'M 190 365 L 209 390 L 205 425 L 214 437 L 188 437 L 185 419 Z');
cut(
	'beef.front-shank',
	[462, 405],
	'M 447 371 L 478 365 L 478 380 L 469 419 L 480 436 L 455 436 L 447 420 Z'
);
cut(
	'chicken.neck',
	[729, 292],
	'M 710 269 L 715 294 Q 706 307 706 319 L 746 315 L 742 304 Q 734 286 741 268 Z'
);
cut(
	'chicken.back',
	[781, 300],
	'M 742 304 L 774 288 Q 799 277 847 295 L 866 307 L 849 322 Q 793 293 746 315 Z'
);
cut(
	'chicken.breast',
	[736, 345],
	'M 706 319 L 746 315 Q 752 347 783 365 L 766 387 Q 726 376 710 352 Q 703 336 706 319 Z'
);
cut(
	'chicken.wing',
	[802, 332],
	'M 746 315 Q 793 293 849 322 Q 840 352 815 360 L 783 365 Q 752 347 746 315 Z'
);
cut(
	'chicken.thigh',
	[816, 375],
	'M 783 365 L 815 360 Q 840 352 849 322 L 861 345 Q 850 375 813 384 L 806 397 L 783 395 L 766 387 Z'
);
cut('chicken.leg', [795, 405], 'M 783 395 L 806 397 L 806 407 L 790 423 L 780 416 Z');
cut(
	'chicken.tail',
	[887, 309],
	'M 847 295 Q 871 277 897 269 L 879 295 Q 898 291 924 282 L 907 316 L 861 345 L 849 322 L 866 307 Z'
);
cut(
	'pork.ham',
	[173, 624],
	'M 149 581 Q 170 562 207 564 L 222 610 L 218 684 L 182 675 Q 130 655 136 617 Z'
);
cut(
	'pork.back-fat',
	[277, 572],
	'M 207 564 Q 231 562 253 565 Q 318 554 358 561 L 354 584 L 213 582 Z'
);
cut('pork.loin', [284, 598], 'M 213 582 L 354 584 L 352 616 L 222 610 Z');
cut('pork.clear-plate', [389, 581], 'M 358 561 Q 391 563 415 571 L 412 597 L 354 584 Z');
cut(
	'pork.butt',
	[436, 606],
	'M 415 571 Q 455 577 470 600 L 490 604 L 482 631 L 413 637 L 412 597 Z'
);
cut('pork.spare-ribs', [275, 636], 'M 222 610 L 352 616 L 350 652 L 220 651 Z');
cut('pork.bacon', [305, 674], 'M 220 651 L 350 652 L 375 691 Q 309 703 218 684 Z');
cut('pork.shoulder', [378, 624], 'M 354 584 L 412 597 L 413 637 L 397 662 L 350 652 L 352 616 Z');
cut(
	'pork.picnic',
	[436, 656],
	'M 413 637 L 482 631 L 483 663 L 461 679 L 427 680 L 375 691 L 350 652 L 397 662 Z'
);
cut(
	'pork.jowl',
	[505, 641],
	'M 490 604 L 512 615 L 527 616 L 524 646 L 511 648 L 483 663 L 482 631 Z'
);
cut('pork.hind-hock', [194, 715], 'M 182 675 L 218 684 L 205 718 L 215 734 L 188 734 L 178 720 Z');
cut('pork.front-hock', [440, 712], 'M 427 680 L 461 679 L 450 716 L 461 733 L 437 733 L 424 716 Z');
cut(
	'lamb.neck',
	[687, 607],
	'M 675 564 L 688 574 L 704 580 L 706 627 L 683 634 L 657 631 L 666 599 Z'
);
cut(
	'lamb.shoulder',
	[726, 613],
	'M 704 580 Q 725 563 749 565 L 748 643 L 723 666 L 694 658 L 683 634 L 706 627 Z'
);
cut('lamb.rack', [773, 591], 'M 749 565 Q 765 564 778 567 L 800 562 L 801 621 L 748 622 Z');
cut('lamb.loin', [826, 584], 'M 800 562 Q 834 558 854 565 L 854 615 L 801 621 Z');
cut('lamb.tenderloin', [825, 627], 'M 801 621 L 854 615 L 858 638 L 799 641 Z');
cut(
	'lamb.leg',
	[879, 618],
	'M 854 565 L 874 571 Q 908 580 902 618 L 889 665 L 860 672 L 858 638 L 854 615 Z'
);
cut(
	'lamb.breast',
	[770, 652],
	'M 748 622 L 801 621 L 799 641 L 800 683 Q 757 680 723 666 L 748 643 Z'
);
cut('lamb.flank', [830, 659], 'M 799 641 L 858 638 L 860 672 Q 832 682 800 683 Z');
cut('lamb.fore-shank', [702, 695], 'M 694 658 L 723 666 L 710 704 L 718 720 L 694 720 L 683 706 Z');
cut('lamb.hind-shank', [876, 702], 'M 860 672 L 889 665 L 884 708 L 893 725 L 871 725 L 860 709 Z');

const palettes = {
	beef: ['#c99179', '#ddb29a', '#b87964'],
	chicken: ['#e5c786', '#d4aa63', '#f0dba8'],
	pork: ['#d99f96', '#e7bbb1', '#c7847e'],
	lamb: ['#b9a2b3', '#d2bdcc', '#a88a9f']
};
for (const [i, region] of cuts.entries()) {
	region.color = palettes[region.ref.split('.')[0]][i % 3];
	region.coordinates = ring(region.d);
	const geometry = polygon([region.coordinates]);
	if (!booleanPointInPolygon(point(region.center), geometry) || kinks(geometry).features.length)
		throw new Error(`Invalid cut ${region.ref}`);
	if (
		!booleanPointInPolygon(
			point(region.center),
			polygon([ring(animals[region.ref.split('.')[0]].body)])
		)
	)
		throw new Error(`Cut outside animal ${region.ref}`);
}

const farmBox = [40, 220, 910, 550];
const animalBox = [0, 280, 720, 520];
const cutsBox = [80, 200, 880, 580];
const farmRefs = [
	'farm.fruit-orchard',
	'farm.sugar-beet',
	'farm.poultry',
	'farm.dairy',
	'farm.beef-cattle',
	'farm.arable',
	'farm.vegetable',
	'farm.pig'
];
const farmRegions = farmRefs.map((ref, i) => {
	const x = 68 + (i % 4) * 221,
		y = 248 + Math.floor(i / 4) * 267;
	return {
		ref,
		center: [x + 100, y + 202],
		d: `M ${x + 12} ${y} L ${x + 187} ${y + 6} Q ${x + 205} ${y + 35} ${x + 199} ${y + 94} L ${x + 193} ${y + 220} L ${x + 4} ${y + 220} L ${x} ${y + 77} Z`,
		x,
		y
	};
});

const tree = (x, y, scale = 1) =>
	group(
		`translate(${x} ${y}) scale(${scale})`,
		ellipse(0, 6, 17, 6, '#5c7349', 'opacity=".18"') +
			path('M -3 4 L -2 -25 L 3 -25 L 4 4 Z', '#896748') +
			ellipse(-8, -30, 13, 17, '#557d4d') +
			ellipse(8, -33, 15, 19, '#769956') +
			ellipse(0, -44, 13, 15, '#91ab62') +
			[-8, 7, 0, 13].map((cx, i) => ellipse(cx, -27 - i * 6, 3, 3, '#c8784e')).join('')
	);
const barn = (x, y, color = '#b76951') =>
	group(
		`translate(${x} ${y})`,
		path('M 0 5 L 70 5 L 70 55 L 0 55 Z', color, 'stroke="#835842" stroke-width="1"') +
			path('M -7 7 L 35 -23 L 78 7 Z', '#565e55') +
			path('M 35 -17 L 71 8 L 71 48 L 90 36 L 90 0 L 52 -25 Z', '#7e8270') +
			path('M 22 25 L 48 25 L 48 55 L 22 55 Z', '#6b5141') +
			line('M 24 27 L 46 53 M 46 27 L 24 53', '#d8b98c', 2) +
			path('M 8 16 L 17 16 L 17 26 L 8 26 Z M 54 16 L 63 16 L 63 26 L 54 26 Z', '#e9d4a4') +
			line(
				'M 4 32 L 18 32 M 4 39 L 18 39 M 4 46 L 18 46 M 52 32 L 67 32 M 52 39 L 67 39 M 52 46 L 67 46',
				'#d4966b',
				0.8
			) +
			line(
				'M 43 -13 L 79 10 M 48 -18 L 85 5 M 72 17 L 88 9 M 72 25 L 88 17 M 72 33 L 88 25',
				'#a0a18a',
				0.8
			)
	);
const fence = (x, y, n = 6) =>
	group(
		`translate(${x} ${y})`,
		line(`M 0 0 L ${(n - 1) * 21} 0 M 0 9 L ${(n - 1) * 21} 9`, '#a78d60', 2) +
			Array.from({ length: n }, (_, i) => line(`M ${i * 21} -5 L ${i * 21} 16`, '#8b7655', 3)).join(
				''
			)
	);
const smallAnimal = (kind, x, y, scale) => {
	const a = animals[kind];
	return group(
		`translate(${x} ${y}) scale(${scale}) translate(${-a.center[0]} ${-a.center[1]})`,
		animalIllustration(a)
	);
};

let farmUnder =
	`<defs><pattern id="paper" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#927b52" opacity=".1"/></pattern></defs>` +
	path('M 40 220 L 950 220 L 950 770 L 40 770 Z', '#f3ecd8') +
	path('M 40 220 L 950 220 L 950 770 L 40 770 Z', 'url(#paper)') +
	line('M 53 494 Q 308 485 495 498 Q 700 510 936 493', '#d8c8a6', 22) +
	line('M 53 494 Q 308 485 495 498 Q 700 510 936 493', '#efe0bd', 13) +
	[278, 499, 720]
		.map((x) => line(`M ${x} 239 Q ${x - 4} 486 ${x + 3} 750`, '#dfd2b5', 10))
		.join('');
let farmOver = shading;
const grounds = [
	'#baca8c',
	'#bbbf7e',
	'#dad0a0',
	'#bfceb0',
	'#c6cb9b',
	'#d9c181',
	'#b9c89c',
	'#d6c4a4'
];
for (const [i, plot] of farmRegions.entries()) {
	farmUnder += path(plot.d, grounds[i], 'stroke="#8d9870" stroke-width="1.4"');
	let detail = '';
	if (i === 0) {
		for (let row = 0; row < 3; row++)
			for (let col = 0; col < 4; col++) detail += tree(29 + col * 44, 48 + row * 49, 0.77);
		detail += fence(17, 159, 8);
	} else if (i === 1 || i === 5 || i === 6) {
		for (let row = 0; row < 6; row++) {
			detail += line(
				`M 15 ${30 + row * 22} Q 90 ${20 + row * 22} 180 ${35 + row * 22}`,
				i === 5 ? '#b19555' : '#8c9d62',
				2
			);
			for (let col = 0; col < 9; col++) {
				const x = 22 + col * 18,
					y = 26 + row * 22;
				if (i === 5 && row < 3)
					detail += line(
						`M ${x} ${y + 3} L ${x} ${y - 12} M ${x} ${y - 6} L ${x - 4} ${y - 10} M ${x} ${y - 3} L ${x + 4} ${y - 7}`,
						'#f5e6ae',
						2
					);
				else if (i === 6)
					detail +=
						ellipse(x, y - 2, 5.7, 4, row % 2 ? '#6c9259' : '#829f62') +
						line(
							`M ${x - 4} ${y - 3} Q ${x} ${y - 7} ${x + 4} ${y - 2} M ${x - 2} ${y} Q ${x} ${y - 6} ${x + 2} ${y}`,
							'#b3c48a',
							0.7
						) +
						(row % 2 ? ellipse(x + 3, y - 1, 1.7, 1.7, '#bd6240') : '');
				else
					detail +=
						path(
							`M ${x} ${y} Q ${x - 10} ${y - 14} ${x} ${y - 5} Q ${x + 10} ${y - 16} ${x + 3} ${y + 1} Z`,
							'#6d914f'
						) + line(`M ${x} ${y} L ${x} ${y - 6}`, '#adc27c', 0.7);
			}
		}
		if (i === 1)
			detail += group(
				'translate(130 137)',
				[0, 18, 36]
					.map(
						(x) =>
							path(`M ${x} 0 Q ${x - 9} 6 ${x} 23 Q ${x + 10} 7 ${x} 0 Z`, '#e3d0a3') +
							line(`M ${x} 0 L ${x - 5} -8 M ${x} 0 L ${x + 5} -10`, '#57744a', 2)
					)
					.join('')
			);
		if (i === 5) detail += ellipse(154, 151, 11, 6, '#aa834f') + ellipse(169, 155, 9, 5, '#bd965d');
		if (i === 6)
			detail +=
				path(
					'M 109 95 L 141 72 L 183 81 L 187 143 L 110 139 Z',
					'#b7d3bd',
					'stroke="#718e7a" stroke-width="2"'
				) +
				line(
					'M 141 72 L 141 139 M 109 95 L 187 104 M 163 78 L 166 141 M 111 116 L 186 123',
					'#e5edcf',
					2
				);
	} else {
		detail += barn(18, 30, i === 7 ? '#a77d61' : i === 2 ? '#bd8d55' : '#b66b50');
		if (i === 2) {
			for (let n = 0; n < 5; n++)
				detail += smallAnimal('chicken', 34 + n * 31, 121 + (n % 2) * 22, 0.12);
			detail +=
				ellipse(156, 51, 15, 8, '#c1a36b') +
				ellipse(152, 49, 3, 4, '#fff4d8') +
				ellipse(160, 51, 3, 4, '#fff4d8');
		} else if (i === 7) {
			detail +=
				ellipse(117, 139, 61, 23, '#b69773') +
				smallAnimal('pork', 104, 117, 0.21) +
				smallAnimal('pork', 153, 145, 0.14);
		} else {
			detail += smallAnimal('beef', 98, 120, 0.24) + smallAnimal('beef', 145, 156, 0.15);
			if (i === 3)
				detail +=
					path('M 135 33 L 145 25 L 156 33 L 156 74 L 135 74 Z', '#adc1b7', outline) +
					ellipse(146, 34, 10, 3, '#dce5d2') +
					line('M 145 42 L 145 67', '#eaf1df', 2) +
					path('M 163 62 L 177 62 L 179 80 L 161 80 Z', '#bcc6ad', outline) +
					line('M 168 62 L 168 57 L 173 57 L 173 62 M 162 70 L 158 68', '#778674');
		}
		detail += fence(13, 166, 9);
	}
	// Small grasses and hedgerows tie the plots into one landscape without text in SVG.
	detail += Array.from({ length: 7 }, (_, n) =>
		line(
			`M ${12 + n * 27} 181 L ${9 + n * 27} 176 M ${12 + n * 27} 181 L ${15 + n * 27} 175`,
			'#7f925e',
			0.9
		)
	).join('');
	farmOver += group(`translate(${plot.x} ${plot.y})`, detail);
}

const paper = (box) =>
	`<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" rx="12" fill="#f5efdf"/>`;
let animalUnder = shading + paper(animalBox),
	animalOver = '';
const animalRegions = [];
for (const a of Object.values(animals)) {
	const [s, x, y] = a.transform;
	const transform = `translate(${x} ${y}) scale(${s})`;
	animalUnder += group(
		transform,
		ellipse(a.center[0], a.center[1] + 112, 177, 13, '#9b9673', 'opacity=".16"') +
			path(farLegs[Object.keys(animals).find((key) => animals[key] === a)], '#b9a589', outline) +
			path(a.body, a.fill, outline) +
			path(a.body, 'url(#volume)')
	);
	animalOver += group(transform, a.detail);
	animalRegions.push({
		ref: a.id,
		center: [a.center[0] * s + x, a.center[1] * s + y + 85],
		coordinates: ring(a.body).map(([px, py]) => [
			Number((px * s + x).toFixed(3)),
			Number((py * s + y).toFixed(3))
		])
	});
}
let cutsUnder = shading + paper(cutsBox),
	cutsOver = '';
for (const [kind, a] of Object.entries(animals)) {
	cutsUnder += path(farLegs[kind], '#c5b9a0', outline) + path(a.body, a.fill, outline);
	const regions = cuts.filter((c) => c.ref.startsWith(`${kind}.`));
	cutsUnder += regions.map((r) => path(r.d, r.color)).join('') + path(a.body, 'url(#volume)');
	// The cut scene has a light anatomical outline, not the coat patches of the easy scene.
	const details =
		kind === 'beef'
			? cattleDetails.slice(4).join('')
			: kind === 'chicken'
				? chickenDetail
				: kind === 'pork'
					? pigDetail
					: lambDetail;
	cutsOver +=
		`<g data-animal="${kind}">` +
		path(a.body, 'none', `${outline} data-silhouette="${kind}"`) +
		details +
		regions.map((r) => line(r.d, '#fff7e8', 1.4)).join('') +
		'</g>';
}

async function asset(name, content) {
	const extension = typeof content === 'string' ? 'svg' : 'json';
	const text = typeof content === 'string' ? content : JSON.stringify(content) + '\n';
	const hash = createHash('sha256').update(text).digest('hex').slice(0, 8);
	const filename = `/taxonomy-maps/${name}.${hash}.${extension}`;
	await writeFile(new URL(`static${filename}`, root), text);
	console.log(filename);
	return { collection: 'externals', filename };
}
async function scene(name, box, regions, under, over) {
	return {
		projection: 'identity',
		viewBox: box,
		topology: {
			type: 'Topology',
			objects: {
				regions: {
					type: 'GeometryCollection',
					geometries: regions.map((r, i) => ({
						id: r.ref,
						type: 'Polygon',
						arcs: [[i]],
						properties: { center: r.center }
					}))
				}
			},
			arcs: regions.map((r) => r.coordinates ?? ring(r.d))
		},
		artwork: {
			underlay: await asset(`${name}-underlay`, svg(box, under)),
			overlay: await asset(`${name}-overlay`, svg(box, over))
		},
		defaults: {
			fillOpacity: 0.16,
			feedbackOpacity: 0.9,
			stroke: '#6e7055',
			strokeWidth: 0.8,
			labelColor: '#493c2b'
		}
	};
}
const farm = await asset('farm-to-table-origins', {
	version: 1,
	scenes: { 'farm-origins': await scene('farm-origins', farmBox, farmRegions, farmUnder, farmOver) }
});
const meat = await asset('meat-cuts-and-animals', {
	version: 1,
	scenes: {
		animals: await scene('meat-animals', animalBox, animalRegions, animalUnder, animalOver),
		cuts: await scene('meat-cuts', cutsBox, cuts, cutsUnder, cutsOver)
	}
});

// Keep source bundles in sync with content-addressed assets and interior helper centers.
for (const [file, reference, regions] of [
	['farm-to-table-origins.taxonomy.yaml', farm, farmRegions],
	['meat-cuts-and-animals.taxonomy.yaml', meat, [...animalRegions, ...cuts]]
]) {
	const url = new URL(`imported/${file}`, root);
	let text = await readFile(url, 'utf8');
	const data = YAML.parse(text);
	const sourceRefs = data.attributeOfItems.flatMap((v) => (v.value?.ref ? [v.value.ref] : []));
	if (JSON.stringify(sourceRefs.sort()) !== JSON.stringify(regions.map((r) => r.ref).sort())) {
		throw new Error(`Source shape references do not match the authored regions in ${file}`);
	}
	for (const r of regions) {
		const item = data.attributeOfItems.find((v) => v.value?.ref === r.ref)?.itemId;
		if (!item) throw new Error(`Missing source item ${r.ref}`);
		const centerAttribute = file.startsWith('farm') ? 'farm-center' : 'map-center';
		const re = new RegExp(
			`(- itemId: ${item}\\n  attributeId: ${centerAttribute}\\n  value:\\n)  - [^\\n]+\\n  - [^\\n]+`
		);
		if (!re.test(text)) throw new Error(`Missing source center ${item}`);
		text = text.replace(
			re,
			`$1  - ${Number(r.center[0].toFixed(3))}\n  - ${Number(r.center[1].toFixed(3))}`
		);
		const iconsAttribute = file.startsWith('farm') ? 'farm-icons' : 'map-icons';
		text = text.replace(
			new RegExp(
				`(- itemId: ${item}\\n  attributeId: ${iconsAttribute}\\n)  value:\\n(?:  - [^\\n]+\\n)+`
			),
			'$1  value: []\n'
		);
	}
	text = text.replace(
		/collection: (?:externals|clients)\n {6}filename: [^\n]+/g,
		`collection: externals\n      filename: ${reference.filename}`
	);
	await writeFile(url, text);
}
console.log(
	`Built 8 farm areas, 4 animals, and ${cuts.length} validated cut regions.`,
	farm.filename,
	meat.filename
);
