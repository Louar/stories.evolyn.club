import type { ColumnType, Generated, JSONColumnType } from 'kysely';
import type { OrientationableColumn, TranslatableColumn } from './0-utils';

export const LogicHitpolicy = {
  first: 'first',
} as const;
export type LogicHitpolicy = (typeof LogicHitpolicy)[keyof typeof LogicHitpolicy];

export const AnthologyPermissionRole = {
  viewer: 'viewer',
  editor: 'editor',
  owner: 'owner',
} as const;
export type AnthologyPermissionRole = (typeof AnthologyPermissionRole)[keyof typeof AnthologyPermissionRole];

export const StoryPermissionRole = {
  viewer: 'viewer',
  editor: 'editor',
  owner: 'owner',
} as const;
export type StoryPermissionRole = (typeof StoryPermissionRole)[keyof typeof StoryPermissionRole];

export const PartBackgroundType = {
  video: 'video',
} as const;
export type PartBackgroundType = (typeof PartBackgroundType)[keyof typeof PartBackgroundType];
export const PartForegroundType = {
  announcement: 'announcement',
  quiz: 'quiz',
} as const;
export type PartForegroundType = (typeof PartForegroundType)[keyof typeof PartForegroundType];

export type StoryModuleSchema = {
  anthology: Anthology;
  anthologyPermission: AnthologyPermission;
  anthologyPosition: AnthologyPosition;
  story: Story;
  storyPermission: StoryPermission;
  storyAuthCode: StoryAuthCode;
  part: Part;
  partTransition: PartTransition;
  video: Video;
  videoAvailableToStory: VideoAvailableToStory;
  announcementTemplate: AnnouncementTemplate;
  announcementTemplateAvailableToStory: AnnouncementTemplateAvailableToStory;
  quizTemplate: QuizTemplate;
  quizTemplateAvailableToStory: QuizTemplateAvailableToStory;
  quizQuestionTemplateAnswerGroup: QuizQuestionTemplateAnswerGroup;
  quizQuestionTemplateAnswerItem: QuizQuestionTemplateAnswerItem;
  quizQuestionTemplate: QuizQuestionTemplate;
  quizLogicForPart: QuizLogicForPart;
  quizLogicRule: QuizLogicRule;
  quizLogicRuleInput: QuizLogicRuleInput;
};

export type AnthologyConfiguration = {
  showPerformanceOverview: boolean;
};

type Anthology = {
  id: Generated<string>;
  clientId: string;
  reference: string;
  name: TranslatableColumn;
  configuration: JSONColumnType<AnthologyConfiguration> | null;
  isPublished: ColumnType<boolean, boolean | null, boolean>;
  isPublic: ColumnType<boolean, boolean | null, boolean>;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date | never>;
  updatedBy: string | null;
};

type AnthologyPermission = {
  id: Generated<string>;
  userId: string;
  anthologyId: string;
  role: ColumnType<AnthologyPermissionRole, AnthologyPermissionRole | null, AnthologyPermissionRole | null>;
  createdAt: ColumnType<Date, never, never>;
};

type AnthologyPosition = {
  id: Generated<string>;
  anthologyId: string;
  storyId: string;
  order: number;
  configuration: JSONColumnType<object> | null;
};

type Story = {
  id: Generated<string>;
  clientId: string;
  reference: string;
  name: TranslatableColumn;
  configuration: JSONColumnType<object> | null;
  isPublished: ColumnType<boolean, boolean | null, boolean>;
  isPublic: ColumnType<boolean, boolean | null, boolean>;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date | never>;
  updatedBy: string | null;
};

type StoryPermission = {
  id: Generated<string>;
  userId: string;
  storyId: string;
  role: ColumnType<StoryPermissionRole, StoryPermissionRole | null, StoryPermissionRole | null>;
  createdAt: ColumnType<Date, never, never>;
};

type StoryAuthCode = {
  id: Generated<string>;
  storyId: string;
  value: string;
  usedAt: ColumnType<Date, Date | null, Date | null>;
}

type Part = {
  id: Generated<string>;
  storyId: string;
  backgroundType: string | null;
  backgroundConfiguration: JSONColumnType<{ start?: number; end?: number;[x: string]: unknown }> | null;
  foregroundType: string | null;
  foregroundConfiguration: JSONColumnType<{ start?: number; end?: number;[x: string]: unknown }> | null;
  isInitial: ColumnType<boolean, boolean | null, boolean>;
  defaultNextPartId: string | null;
  videoId: string | null;
  announcementTemplateId: string | null;
  quizLogicForPartId: string | null;
  position: JSONColumnType<{ x: number; y: number }> | null;
};

type PartTransition = {
  id: Generated<string>;
  session: string | null;
  fromPartId: string;
  toPartId: string;
  createdAt: ColumnType<Date, never, never>;
};

type Video = {
  id: Generated<string>;
  name: string;
  source: OrientationableColumn;
  thumbnail: OrientationableColumn | null;
  captions: TranslatableColumn | null;
  duration: number;
};
type VideoAvailableToStory = {
  id: Generated<string>;
  storyId: string;
  videoId: string;
};

type AnnouncementTemplate = {
  id: Generated<string>;
  name: string;
  title: TranslatableColumn | null;
  message: TranslatableColumn | null;
};
type AnnouncementTemplateAvailableToStory = {
  id: Generated<string>;
  storyId: string;
  announcementTemplateId: string;
};

type QuizTemplate = {
  id: Generated<string>;
  name: string;
  doRandomize: ColumnType<boolean, boolean | null, boolean>;
};
type QuizTemplateAvailableToStory = {
  id: Generated<string>;
  storyId: string;
  quizTemplateId: string;
};

type QuizQuestionTemplateAnswerGroup = {
  id: Generated<string>;
  reference: string | null;
  name: string | null;
  doRandomize: ColumnType<boolean, boolean | null, boolean>;
  isGlobal: ColumnType<boolean, boolean | null, boolean>;
};

type QuizQuestionTemplateAnswerItem = {
  id: Generated<string>;
  quizQuestionTemplateAnswerGroupId: string;
  order: number;
  value: string;
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
  nextPartId: string | null;
};

type QuizLogicRuleInput = {
  id: Generated<string>;
  quizLogicRuleId: string;
  quizQuestionTemplateId: string;
  quizQuestionTemplateAnswerItemId: string | null;
  value: JSONColumnType<object> | null;
};