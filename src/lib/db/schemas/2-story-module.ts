import type { ColumnType, Generated, JSONColumnType } from 'kysely';
import type { TranslatableColumn } from './0-utils';

export const LogicHitpolicy = {
  first: 'first',
} as const;
export type LogicHitpolicy = (typeof LogicHitpolicy)[keyof typeof LogicHitpolicy];

export type StoryModuleSchema = {
  story: Story;
  part: Part;
  video: Video;
  announcementTemplate: AnnouncementTemplate;
  quizTemplate: QuizTemplate;
  quizQuestionTemplateAnswerGroup: QuizQuestionTemplateAnswerGroup;
  quizQuestionTemplateAnswerItem: QuizQuestionTemplateAnswerItem;
  quizQuestionTemplate: QuizQuestionTemplate;
  quizLogicForPart: QuizLogicForPart;
  quizLogicRule: QuizLogicRule;
  quizLogicRuleInput: QuizLogicRuleInput;
};

type Story = {
  id: Generated<string>;
  clientId: string;
  reference: string;
  name: string;
  configuration: JSONColumnType<object> | null;
  isPublished: ColumnType<boolean, boolean | null, boolean>;
  isPublic: ColumnType<boolean, boolean | null, boolean>;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, never>;
  updatedBy: string | null;
};

type Part = {
  id: Generated<string>;
  storyId: string;
  backgroundType: string | null;
  backgroundConfiguration: JSONColumnType<object> | null;
  foregroundType: string | null;
  foregroundConfiguration: JSONColumnType<object> | null;
  duration: number;
  isInitial: ColumnType<boolean, boolean | null, boolean>;
  isFinal: ColumnType<boolean, boolean | null, boolean>;
  defaultNextPartId: string | null;
  videoId: string | null;
  announcementTemplateId: string | null;
  quizLogicForPartId: string | null;
};

type Video = {
  id: Generated<string>;
  name: string;
  source: JSONColumnType<{ portrait?: string; landscape?: string; square?: string; default?: string }>;
  thumbnail: JSONColumnType<{ portrait?: string; landscape?: string; square?: string; default?: string }> | null;
  captions: TranslatableColumn | null;
  duration: number;
};

type AnnouncementTemplate = {
  id: Generated<string>;
  name: string;
  title: TranslatableColumn | null;
  message: TranslatableColumn | null;
};

type QuizTemplate = {
  id: Generated<string>;
  name: string;
  doRandomize: ColumnType<boolean, boolean | null, boolean>;
};

type QuizQuestionTemplateAnswerGroup = {
  id: Generated<string>;
  reference: string; // unique
  name: string;
};

type QuizQuestionTemplateAnswerItem = {
  id: Generated<string>;
  quizQuestionTemplateAnswerGroupId: string;
  order: number;
  value: JSONColumnType<object>;
  label: TranslatableColumn;
};

type QuizQuestionTemplate = {
  id: Generated<string>;
  quizTemplateId: string;
  order: number;
  answerTemplateReference: string;
  title: TranslatableColumn;
  instruction: TranslatableColumn | null;
  placeholder: TranslatableColumn | null;
  configuration: JSONColumnType<object> | null;
  isRequired: ColumnType<boolean, boolean | null, boolean>;
  quizQuestionTemplateAnswerGroupId: string | null;
};

type QuizLogicForPart = {
  id: Generated<string>;
  quizTemplateId: string;
  defaultNextPartId: string | null;
  hitpolicy: ColumnType<LogicHitpolicy, LogicHitpolicy | null, LogicHitpolicy>;
};

type QuizLogicRule = {
  id: Generated<string>;
  order: number;
  name: string;
  quizLogicForPartId: string;
  nextPartId: string;
};

type QuizLogicRuleInput = {
  id: Generated<string>;
  quizLogicRuleId: string;
  quizQuestionTemplateId: string;
  quizQuestionTemplateAnswerItemId: string | null;
  value: JSONColumnType<object> | null;
};