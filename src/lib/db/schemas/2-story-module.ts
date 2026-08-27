import type { ColumnType, Generated, JSONColumnType } from 'kysely';
import type { MediaColumn, TranslatableColumn, TranslatableMediaColumn } from './0-utils';

export const LogicHitpolicy = {
  first: 'first'
} as const;
export type LogicHitpolicy = (typeof LogicHitpolicy)[keyof typeof LogicHitpolicy];

export const AnthologyPermissionRole = {
  viewer: 'viewer',
  editor: 'editor',
  owner: 'owner'
} as const;
export type AnthologyPermissionRole =
  (typeof AnthologyPermissionRole)[keyof typeof AnthologyPermissionRole];

export const StoryPermissionRole = {
  viewer: 'viewer',
  editor: 'editor',
  owner: 'owner'
} as const;
export type StoryPermissionRole = (typeof StoryPermissionRole)[keyof typeof StoryPermissionRole];

export const PartBackgroundType = {
  still: 'still',
  video: 'video'
} as const;
export type PartBackgroundType = (typeof PartBackgroundType)[keyof typeof PartBackgroundType];
export const PartForegroundType = {
  announcement: 'announcement',
  quiz: 'quiz',
  taxonomy: 'taxonomy'
} as const;
export type PartForegroundType = (typeof PartForegroundType)[keyof typeof PartForegroundType];

export const AttributeType = {
  integer: 'integer',
  number: 'number',
  translatable: 'translatable',
  translatableCategory: 'translatable_category',
  itemReference: 'item_reference',
  custom: 'custom'
} as const;
export type AttributeType = (typeof AttributeType)[keyof typeof AttributeType];

export type StoryModuleSchema = {
  anthology: Anthology;
  anthologyPermission: AnthologyPermission;
  anthologyPosition: AnthologyPosition;
  story: Story;
  storyPermission: StoryPermission;
  storyAuthCode: StoryAuthCode;
  part: Part;
  still: Still;
  stillAvailableToStory: StillAvailableToStory;
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
  eventTransition: EventTransition;
  eventInteraction: EventInteraction;
  taxonomy: Taxonomy;
  category: Category;
  attribute: Attribute;
  attributeOfCategory: AttributeOfCategory;
  item: Item;
  itemOfCategory: ItemOfCategory;
  attributeOfItem: AttributeOfItem;
  taxonomyDraftForPart: TaxonomyDraftForPart;
  taxonomyDraftLogicRule: TaxonomyDraftLogicRule;
  draftedAttribute: DraftedAttribute;
  draftedCategory: DraftedCategory;
  draftedItem: DraftedItem;
};

export type AnthologyConfiguration = {
  showPerformanceOverview: boolean;
};

type Anthology = {
  id: Generated<string>;
  clientId: string;
  slug: string;
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
  role: ColumnType<
    AnthologyPermissionRole,
    AnthologyPermissionRole | null,
    AnthologyPermissionRole | null
  >;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date | never>;
  updatedBy: string | null;
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
  slug: string;
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
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date | never>;
  updatedBy: string | null;
};

type StoryAuthCode = {
  id: Generated<string>;
  storyId: string;
  value: string;
  usedAt: ColumnType<Date, Date | null, Date | null>;
};

type Part = {
  id: Generated<string>;
  storyId: string;
  backgroundType: string | null;
  backgroundConfiguration: JSONColumnType<{
    start?: number;
    end?: number;
    [x: string]: unknown;
  }> | null;
  foregroundType: string | null;
  foregroundConfiguration: JSONColumnType<{
    start?: number;
    end?: number;
    [x: string]: unknown;
  }> | null;
  isInitial: ColumnType<boolean, boolean | null, boolean>;
  defaultNextPartId: string | null;
  stillId: string | null;
  videoId: string | null;
  announcementTemplateId: string | null;
  quizLogicForPartId: string | null;
  taxonomyDraftForPartId: string | null;
  position: JSONColumnType<{ x: number; y: number }> | null;
};

type Still = {
  id: Generated<string>;
  color: string | null;
  image: MediaColumn | null;
  style: string | null;
};
type StillAvailableToStory = {
  id: Generated<string>;
  storyId: string;
  stillId: string;
};

type Video = {
  id: Generated<string>;
  name: string;
  source: TranslatableMediaColumn;
  thumbnail: TranslatableMediaColumn | null;
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
  slug: string | null;
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
  answerTemplateSlug: string;
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

type EventTransition = {
  id: Generated<string>;
  url: string;
  session: string;
  createdAt: ColumnType<Date, Date | string, never>;
  fromPartId: string;
  toPartId: string;
};

type EventInteraction = {
  id: Generated<string>;
  url: string;
  session: string;
  createdAt: ColumnType<Date, Date | string, never>;
  partId: string;
  quizQuestionTemplateId: string;
  quizQuestionTemplateAnswerItemId: string | null;
  value: JSONColumnType<object> | null;
};

type Taxonomy = {
  id: Generated<string>;
  clientId: string;
  name: string;
  description: string | null;
};

type Category = {
  id: Generated<string>;
  taxonomyId: string;
  name: TranslatableColumn;
  image: MediaColumn | null;
  description: TranslatableColumn | null;
  map: JSONColumnType<object> | null;
};

type Attribute = {
  id: Generated<string>;
  taxonomyId: string;
  slug: string;
  name: TranslatableColumn;
  image: MediaColumn | null;
  description: TranslatableColumn | null;
  type: AttributeType;
  referencedCategoryId: string | null;
  schema: JSONColumnType<Record<string, unknown>> | null;
};

type AttributeOfCategory = {
  categoryId: string;
  attributeId: string;
  order: number | null;
  isRequired: ColumnType<boolean, boolean | undefined, boolean>;
  isDefault: ColumnType<boolean, boolean | undefined, boolean>;
};

type Item = {
  id: Generated<string>;
  taxonomyId: string;
  // name: TranslatableColumn;
  // image: MediaColumn | null;
  // description: TranslatableColumn | null;
  // emoji: string | null;
  // outline: JSONColumnType<object | null>;
};

type ItemOfCategory = {
  itemId: string;
  categoryId: string;
};

type AttributeOfItem = {
  itemId: string;
  attributeId: string;
  value: JSONColumnType<Record<string, unknown>> | null;
  referencedItemId: string | null;
  difficulty: number | null;
};

type TaxonomyDraftForPart = {
  id: Generated<string>;
  taxonomyId: string;
  nrOfRounds: number | null;
  nrOfItemsPerRound: number | null;
  goal: number | null;
  maxMistakes: number | null;
  difficulty: number | null;
  defaultNextPartId: string | null;
  createdAt: ColumnType<Date, never, never>;
  createdBy: string | null;
  updatedAt: ColumnType<Date, never, Date>;
  updatedBy: string | null;
};

type TaxonomyDraftLogicRule = {
  id: Generated<string>;
  taxonomyDraftForPartId: string;
  nextPartId: string | null;
  order: number;
  name: string;
  nrOfRounds: JSONColumnType<[number | null, number | null]> | null;
  score: JSONColumnType<[number | null, number | null]> | null;
  mistakes: JSONColumnType<[number | null, number | null]> | null;
  duration: JSONColumnType<[number | null, number | null]> | null;
};

type DraftedAttribute = {
  taxonomyDraftForPartId: string;
  attributeId: string;
};

type DraftedCategory = {
  taxonomyDraftForPartId: string;
  categoryId: string;
};

type DraftedItem = {
  taxonomyDraftForPartId: string;
  itemId: string;
};
