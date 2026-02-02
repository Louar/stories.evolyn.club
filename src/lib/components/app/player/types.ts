import type { LogicHitpolicy } from "$lib/db/schemas/2-story-module";

type LogicInput = {
  id: string;
  field: string;
  name: string;
};

type LogicOutput = {
  id: string;
  field: string;
  name: string;
};

export type Rule = {
  _id: string;
  _description?: string;
  // input fields are stored as JSON-encoded strings like '"YES"'
  [field: string]: unknown;
};

export type Logic<
  I extends readonly LogicInput[] = readonly LogicInput[],
  O extends readonly LogicOutput[] = readonly LogicOutput[]
> = {
  hitPolicy: LogicHitpolicy;
  inputs: I;
  outputs: O;
  rules: Rule[];
};

export type InputFromLogic<L extends Logic> = Partial<Record<L['inputs'][number]['field'], unknown>>;
export type OutputFromLogic<L extends Logic> = Partial<Record<L['outputs'][number]['field'], unknown>>;

export type Player = {
  id: string;
  source: string;
  thumbnail: string | undefined;
  captions: string | undefined;
  start: number | undefined;
  end: number | undefined;
  playbackRate: number;
  isInitialPart: boolean;
  next: string | undefined;
  doBuffer: boolean;
  doPlay: boolean;
  doRestart: boolean;
  doEnd: boolean;
  time: number;
};
