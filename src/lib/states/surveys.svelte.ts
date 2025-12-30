import { z } from 'zod/v4';

export const AnswerTemplateReference = {
  textShort: 'textShort',
  textLong: 'textLong',
  numberInput: 'numberInput',
  numberRange: 'numberRange',
  selectSingle: 'selectSingle',
  selectMultiple: 'selectMultiple',
} as const;
export type AnswerTemplateReference = (typeof AnswerTemplateReference)[keyof typeof AnswerTemplateReference];

const textSettings = z.object({
  default: z.string().optional(),
  min: z.number().int().default(0).optional(),
  max: z.number().int().default(560).optional(),
});

const numberSettings = z.object({
  default: z.number().int().optional(),
  min: z.number().int().default(0).optional(),
  max: z.number().int().default(100).optional(),
  step: z.number().int().default(1).optional(),
  unit: z.string().optional(),
});

export const ANSWER_TEMPLATES = [
  {
    reference: AnswerTemplateReference.textShort,
    name: 'Text short',
    description: `Input short text.`,
    schema: z.string(),
    settings: textSettings,
  },
  {
    reference: AnswerTemplateReference.textLong,
    name: 'Text long',
    description: `Input long text.`,
    schema: z.string(),
    settings: textSettings.extend({ rows: z.number().int().default(4).optional() }),
  },
  {
    reference: AnswerTemplateReference.numberInput,
    name: 'Number input',
    description: `Input number via keyboard.`,
    schema: z.number().int(),
    settings: numberSettings,
  },
  {
    reference: AnswerTemplateReference.numberRange,
    name: 'Number range',
    description: `Input number via range slider.`,
    schema: z.number().int(),
    settings: numberSettings,
  },
  {
    reference: AnswerTemplateReference.selectSingle,
    name: 'Select single',
    description: `Select a single option from a list.`,
    schema: z.number().int(),
    settings: z.object({ default: z.number().int().optional() }),
  },
  {
    reference: AnswerTemplateReference.selectMultiple,
    name: 'Select multiple',
    description: `Select multiple options from a list.`,
    schema: z.number().int().array(),
    settings: z.object({ default: z.number().int().array().optional() }),
  },
] as const;

export class SurveyPayload {
  template!: string;
  start?: Date | null;
  end?: Date | null;
  responses!: Record<string, string | number | number[] | null | undefined>;

  constructor(params: SurveyPayload) {
    Object.assign(this, params);
  }
};
