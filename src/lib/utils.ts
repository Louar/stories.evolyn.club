import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export const moveArrayItem = <T,>(array: T[], fromIndex: number, to: number): T[] => {
	const newArray = [...array];
	const [removed] = newArray.splice(fromIndex, 1);
	newArray.splice(to, 0, removed);
	return newArray;
};

export const clean = <T>(value: T): T => {
	type Removable = {
		isRemoved?: boolean;
	};

	if (Array.isArray(value)) {
		return value
			.filter(
				(item): item is Exclude<T extends (infer U)[] ? U : never, Removable> =>
					!(item && typeof item === "object" && (item as Removable).isRemoved === true)
			)
			.map(clean) as T;
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, val]) => [
				key,
				clean(val),
			])
		) as T;
	}

	return value;
}

