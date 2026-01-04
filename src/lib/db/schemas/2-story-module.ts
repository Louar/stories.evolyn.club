import type { ColumnType, Generated, JSONColumnType } from 'kysely';
import type { TranslatableColumn } from './0-utils';

export const LogicHitpolicy = {
  first: 'first',
} as const;
export type LogicHitpolicy = (typeof LogicHitpolicy)[keyof typeof LogicHitpolicy];

export type StoryModuleSchema = {
  video: Video;
  announcement_template: AnnouncementTemplate;
  quiz_template: QuizTemplate;
  quiz_question_template_answer_group: QuizQuestionTemplateAnswerGroup;
  quiz_question_template_answer_item: QuizQuestionTemplateAnswerItem;
  quiz_question_template: QuizQuestionTemplate;
  story: Story;
  part: Part;
  quiz_logic_for_part: QuizLogicForPart;
  quiz_logic_rule: QuizLogicRule;
  quiz_logic_rule_input: QuizLogicRuleInput;
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
  do_randomize: ColumnType<boolean, boolean | null, boolean>;
};

type QuizQuestionTemplateAnswerGroup = {
  id: Generated<string>;
  reference: string; // unique
  name: string;
};

type QuizQuestionTemplateAnswerItem = {
  id: Generated<string>;
  quiz_question_template_answer_group_id: string;
  order: number;
  value: JSONColumnType<object>;
  label: TranslatableColumn;
};

type QuizQuestionTemplate = {
  id: Generated<string>;
  quiz_template_id: string;
  order: number;
  answer_template_reference: string;
  title: TranslatableColumn;
  instruction: TranslatableColumn | null;
  placeholder: TranslatableColumn | null;
  configuration: JSONColumnType<object> | null;
  is_required: ColumnType<boolean, boolean | null, boolean>;
  quiz_question_template_answer_group_id: string | null;
};

type Story = {
  id: Generated<string>;
  name: string;
  configuration: JSONColumnType<object> | null;
  is_published: ColumnType<boolean, boolean | null, boolean>;
  is_public: ColumnType<boolean, boolean | null, boolean>;
  created_at: ColumnType<Date, never, never>;
  created_by: string | null;
  updated_at: ColumnType<Date, never, never>;
  updated_by: string | null;
};

type Part = {
  id: Generated<string>;
  story_id: string;
  background_type: string | null;
  background_configuration: JSONColumnType<object> | null;
  foreground_type: string | null;
  foreground_configuration: JSONColumnType<object> | null;
  duration: number;
  is_initial: ColumnType<boolean, boolean | null, boolean>;
  is_final: ColumnType<boolean, boolean | null, boolean>;
  default_next_part_id: string | null;
  video_id: string | null;
  announcement_template_id: string | null;
  quiz_logic_for_part_id: string | null; // added via alterTable
};

type QuizLogicForPart = {
  id: Generated<string>;
  quiz_question_template_id: string;
  default_next_part_id: string | null;
  hitpolicy: ColumnType<LogicHitpolicy, LogicHitpolicy | null, LogicHitpolicy>;
};

type QuizLogicRule = {
  id: Generated<string>;
  quiz_logic_for_part_id: string;
  next_part_id: string;
};

type QuizLogicRuleInput = {
  id: Generated<string>;
  quiz_logic_rule_id: string;
  quiz_question_template_id: string;
  quiz_question_template_answer_item_id: string | null;
  value: JSONColumnType<object> | null;
};
