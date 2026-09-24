type Completion = {
	type: string;
	label: string;
	detail: string;
	info: string;
	boost?: number | null;
	methodFor?: string | null;
};

const completions: Completion[] = [
	{
		type: 'function',
		label: 'len',
		detail: '(var: `string | any[]`) -> number',
		info: 'Returns the length of variable',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'contains',
		detail: '(haystack: `string | any[]`, needle: `any | string`) -> bool',
		info: 'Checks if variable contains a needle',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'flatten',
		detail: '(arr: `any[]`) -> any[]',
		info: 'Flattens an array',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'merge',
		detail: '(objects: `object[] | any[]`) -> any[] | object',
		info: 'Merges multiple objects into one.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'mergeDeep',
		detail: '(objects: `object[]`) -> object',
		info: 'Deeply merges multiple objects into one.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'upper',
		detail: '(str: `string`) -> string',
		info: 'Converts all characters in a string to uppercase',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'lower',
		detail: '(str: `string`) -> string',
		info: 'Converts all characters in a string to lowercase',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'trim',
		detail: '(str: `string`) -> string',
		info: 'Returns the string with leading and trailing whitespace removed',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'startsWith',
		detail: '(str: `string`, prefix: `string`) -> bool',
		info: 'Returns true if the string starts with the specified prefix',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'endsWith',
		detail: '(str: `string`, suffix: `string`) -> bool',
		info: 'Returns true if the string ends with the specified suffix',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'matches',
		detail: '(str: `string`, pattern: `string`) -> bool',
		info: 'Returns true if the string matches the specified pattern',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'extract',
		detail: '(str: `string`, pattern: `string`) -> string[]',
		info: 'Extracts matching substrings according to a pattern',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'fuzzyMatch',
		detail: '(haystack: `string[] | string`, needle: `string`) -> number | number[]',
		info: 'Performs a fuzzy search of the needle in the haystack, and returns the match score(s).',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'split',
		detail: '(str: `string`, delimiter: `string`) -> string[]',
		info: 'Splits a string into an array of substrings using the specified delimiter.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'abs',
		detail: '(num: `number`) -> number',
		info: 'Returns the absolute value of a number',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'sum',
		detail: '(arr: `number[]`) -> number',
		info: 'Returns the sum of all elements in the input array.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'avg',
		detail: '(arr: `number[]`) -> number',
		info: 'Calculates the average of all elements in the input array.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'min',
		detail: '(arr: `date[] | number[]`) -> number | date',
		info: 'Returns the smallest of the elements in the input array.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'max',
		detail: '(arr: `number[] | date[]`) -> date | number',
		info: 'Returns the largest of the elements in the input array.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'rand',
		detail: '(max: `number`) -> number',
		info: 'Generates a random number between 0 (inclusive) and max (inclusive).',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'median',
		detail: '(arr: `number[]`) -> number',
		info: 'Calculates the median value of all elements in the input array.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'mode',
		detail: '(arr: `number[]`) -> number',
		info: 'Finds the mode(s) of the input array, which are the most frequent element(s).',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'floor',
		detail: '(num: `number`) -> number',
		info: 'Rounds a number down to the nearest integer.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'ceil',
		detail: '(num: `number`) -> number',
		info: 'Rounds a number up to the nearest integer.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'round',
		detail: '(num: `number`, digits?: `Optional<number>`) -> number',
		info: 'Rounds a number to a specified number of decimal places.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'trunc',
		detail: '(num: `number`, digits?: `Optional<number>`) -> number',
		info: 'Truncates a number to a specified number of decimal places.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'isNumeric',
		detail: '(value: `any`) -> bool',
		info: 'Checks if the given value is of a numeric type.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'string',
		detail: '(value: `any`) -> string',
		info: 'Converts the given value to a string.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'number',
		detail: '(value: `any`) -> number',
		info: 'Converts the given value to a number.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'bool',
		detail: '(value: `any`) -> bool',
		info: 'Converts the given value to a boolean.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'type',
		detail: '(value: `any`) -> string',
		info: 'Returns a string representing the data type of the value.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'keys',
		detail: '(obj: `any[] | object`) -> string[] | number[]',
		info: "Returns an array of a given object's own enumerable property names.",
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'values',
		detail: '(obj: `object`) -> any[]',
		info: "Returns an array of a given object's own enumerable property values.",
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'd',
		detail: '(dateOrTimezone?: `Optional<any>`, timezone?: `Optional<string>`) -> date',
		info: 'Returns a new date time instance.',
		boost: 10,
		methodFor: null
	},
	{
		type: 'function',
		label: 'date',
		detail: '(timestamp: `any`) -> number',
		info: 'Converts a numeric timestamp to a unix timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'time',
		detail: '(timestamp: `any`) -> number',
		info: 'Extracts the time from a numeric timestamp and returns it as a seconds from beginning of day.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'duration',
		detail: '(duration: `any`) -> number',
		info: 'e.g. 1h30min',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'year',
		detail: '(timestamp: `any`) -> number',
		info: 'Extracts the year from a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'dayOfWeek',
		detail: '(timestamp: `any`) -> number',
		info: 'Gets the day of the week from a given timestamp, where Sunday might be 0.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'dayOfMonth',
		detail: '(timestamp: `any`) -> number',
		info: 'Extracts the day of the month from a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'dayOfYear',
		detail: '(timestamp: `any`) -> number',
		info: 'Gets the day of the year from a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'weekOfYear',
		detail: '(timestamp: `any`) -> number',
		info: 'Calculates the week of the year from a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'monthOfYear',
		detail: '(timestamp: `any`) -> number',
		info: 'Extracts the month from a given timestamp, typically with January as 1.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'monthString',
		detail: '(timestamp: `any`) -> string',
		info: "Converts the month from a given timestamp into its string representation (e.g., 'Jan').",
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'dateString',
		detail: '(timestamp: `any`) -> string',
		info: 'Converts a timestamp to a human-readable date string.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'weekdayString',
		detail: '(timestamp: `any`) -> string',
		info: "Converts the day of the week from a given timestamp into its string representation (e.g., 'Mon').",
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'startOf',
		detail: '(timestamp: `any`, unit: `string`) -> number',
		info: 'Returns the timestamp representing the start of a specified unit (e.g., day, month, year) based on a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'endOf',
		detail: '(timestamp: `any`, unit: `string`) -> number',
		info: 'Returns the timestamp representing the end of a specified unit (e.g., day, month, year) based on a given timestamp.',
		boost: -20,
		methodFor: null
	},
	{
		type: 'function',
		label: 'all',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `boolean`',
		info: 'Checks if all elements in the array satisfy the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'none',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `boolean`',
		info: 'Checks if no elements in the array satisfy the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'some',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `boolean`',
		info: 'Checks if at least one element in the array satisfies the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'one',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `boolean`',
		info: 'Checks if exactly one element in the array satisfies the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'filter',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `T[]`',
		info: 'Creates a new array with all elements that satisfy the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'map',
		detail: '`<T, U>`(array: `T[]`, callback: `Callback<T, U>`) -> `U[]`',
		info: 'Creates a new array populated with the results of calling the provided function on every element in the calling array.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'flatMap',
		detail: '`<T, U>`(array: `T[]`, callback: `Callback<T, U[]>`) -> `U[]`',
		info: 'First maps each element using a mapping function, then flattens the result into a new array.',
		boost: null,
		methodFor: null
	},
	{
		type: 'function',
		label: 'count',
		detail: '`<T>`(array: `T[]`, callback: `Callback<T, boolean>`) -> `number`',
		info: 'Counts the number of elements in the array that satisfy the condition defined in the callback.',
		boost: null,
		methodFor: null
	},
	...[
		'add',
		'sub',
		'set',
		'format',
		'startOf',
		'endOf',
		'diff',
		'tz',
		'isSame',
		'isBefore',
		'isAfter',
		'isSameOrBefore',
		'isSameOrAfter',
		'second',
		'minute',
		'hour',
		'day',
		'dayOfYear',
		'week',
		'weekday',
		'month',
		'quarter',
		'year',
		'timestamp',
		'offsetName',
		'isValid',
		'isYesterday',
		'isToday',
		'isTomorrow',
		'isLeapYear'
	].map((label) => ({
		type: 'method',
		label,
		detail: 'Date method',
		info: 'Date helper method',
		boost: null,
		methodFor: 'date'
	})),
	{
		type: 'variable',
		label: '$root',
		detail: 'Root variable',
		info: '',
		boost: -10,
		methodFor: null
	}
];

export const getCompletions = () => completions;
