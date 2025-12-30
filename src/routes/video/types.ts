
export enum HitPolicy {
  'first' = 'first'
};

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
  hitPolicy: HitPolicy;
  inputs: I;
  outputs: O;
  rules: Rule[];
};

export type InputFromLogic<L extends Logic> = Partial<Record<L['inputs'][number]['field'], unknown>>;
export type OutputFromLogic<L extends Logic> = Partial<Record<L['outputs'][number]['field'], unknown>>;