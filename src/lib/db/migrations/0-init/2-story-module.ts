import { LogicHitpolicy } from '$lib/db/schemas/2-story-module';
import type { Kysely, Migration } from 'kysely';
import { sql } from 'kysely';

export const InitStoryModule: Migration = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async up(db: Kysely<any>) {

    // Create Types
    await db.schema.dropType('logic_hitpolicy').ifExists().execute();
    await db.schema.createType('logic_hitpolicy')
      .asEnum(Object.values(LogicHitpolicy))
      .execute();


    // Create Video table
    await db.schema.createTable('video')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('source', 'jsonb', col => col.notNull())
      .addColumn('thumbnail', 'jsonb')
      .addColumn('captions', 'jsonb')
      .addColumn('duration', 'smallint', col => col.notNull())
      .execute();

    // Create AnnouncementTemplate table
    await db.schema.createTable('announcement_template')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('title', 'jsonb')
      .addColumn('message', 'jsonb')
      .execute();

    // Create QuizTemplate table
    await db.schema.createTable('quiz_template')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('do_randomize', 'boolean', col => col.defaultTo(false).notNull())
      .execute();

    // Create QuizQuestionTemplateAnswerGroup table
    await db.schema.createTable('quiz_question_template_answer_group')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('reference', 'text', col => col.unique().notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('do_randomize', 'boolean', col => col.defaultTo(false).notNull())
      .execute();

    // Create QuizQuestionTemplateAnswerItem table
    await db.schema.createTable('quiz_question_template_answer_item')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('quiz_question_template_answer_group_id', 'uuid', (col) => col.references('quiz_question_template_answer_group.id').onDelete('cascade').notNull())
      .addColumn('order', 'smallint', (col) => col.notNull())
      .addColumn('value', 'jsonb', (col) => col.notNull())
      .addColumn('label', 'jsonb', (col) => col.notNull())
      .execute();

    // Create QuizQuestionTemplate table
    await db.schema.createTable('quiz_question_template')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('quiz_template_id', 'uuid', (col) => col.references('quiz_template.id').onDelete('cascade').notNull())
      .addColumn('order', 'smallint', (col) => col.notNull())
      .addColumn('answer_template_reference', 'text', (col) => col.notNull())
      .addColumn('title', 'jsonb', (col) => col.notNull())
      .addColumn('instruction', 'jsonb')
      .addColumn('placeholder', 'jsonb')
      .addColumn('configuration', 'jsonb')
      .addColumn('is_required', 'boolean', col => col.defaultTo(true).notNull())
      .addColumn('quiz_question_template_answer_group_id', 'uuid', (col) => col.references('quiz_question_template_answer_group.id').onDelete('cascade'))
      .execute();

    // Create Story table
    await db.schema.createTable('story')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('client_id', 'uuid', (col) => col.references('client.id').onDelete('cascade').notNull())
      .addColumn('reference', 'text', col => col.notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('configuration', 'jsonb')
      .addColumn('is_published', 'boolean', col => col.defaultTo(false).notNull())
      .addColumn('is_public', 'boolean', col => col.defaultTo(false).notNull())
      .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
      .addUniqueConstraint('unique_story_per_client', ['client_id', 'reference'])
      .execute();

    // Create Part table
    await db.schema.createTable('part')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade').notNull())
      .addColumn('background_type', 'text')
      .addColumn('background_configuration', 'jsonb')
      .addColumn('foreground_type', 'text')
      .addColumn('foreground_configuration', 'jsonb')
      .addColumn('is_initial', 'boolean', col => col.defaultTo(false).notNull())
      .addColumn('is_final', 'boolean', col => col.defaultTo(false).notNull())
      .addColumn('default_next_part_id', 'uuid', (col) => col.references('part.id').onDelete('set null'))
      .addColumn('video_id', 'uuid', (col) => col.references('video.id').onDelete('set null'))
      .addColumn('announcement_template_id', 'uuid', (col) => col.references('announcement_template.id').onDelete('set null'))
      .addColumn('position', 'jsonb')
      .execute();

    // Create QuizLogicForPart table
    await db.schema.createTable('quiz_logic_for_part')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('quiz_template_id', 'uuid', (col) => col.references('quiz_template.id').onDelete('cascade').notNull())
      .addColumn('default_next_part_id', 'uuid', (col) => col.references('part.id').onDelete('set null'))
      .addColumn('hitpolicy', sql`logic_hitpolicy`, (col) => col.defaultTo(LogicHitpolicy.first).notNull())
      .execute();

    await db.schema.alterTable('part')
      .addColumn('quiz_logic_for_part_id', 'uuid', (col) => col.references('quiz_logic_for_part.id').onDelete('set null'))
      .execute();

    // Create QuizLogicRule table
    await db.schema.createTable('quiz_logic_rule')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('order', 'smallint', (col) => col.notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('quiz_logic_for_part_id', 'uuid', (col) => col.references('quiz_logic_for_part.id').onDelete('cascade').notNull())
      .addColumn('next_part_id', 'uuid', (col) => col.references('part.id').onDelete('cascade').notNull())
      .execute();

    // Create QuizLogicRuleInput table
    await db.schema.createTable('quiz_logic_rule_input')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('quiz_logic_rule_id', 'uuid', (col) => col.references('quiz_logic_rule.id').onDelete('cascade').notNull())
      .addColumn('quiz_question_template_id', 'uuid', (col) => col.references('quiz_question_template.id').onDelete('cascade').notNull())
      .addColumn('quiz_question_template_answer_item_id', 'uuid', (col) => col.references('quiz_question_template_answer_item.id').onDelete('cascade'))
      .addColumn('value', 'jsonb', (col) => col.notNull())
      .execute();

    // Create VideoAvailableToStory table
    await db.schema.createTable('video_available_to_story')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
      .addColumn('video_id', 'uuid', (col) => col.references('video.id').onDelete('cascade'))
      .addUniqueConstraint('unique_video_per_story', ['story_id', 'video_id'])
      .execute();

    // Create AnnouncementTemplateAvailableToStory table
    await db.schema.createTable('announcement_template_available_to_story')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
      .addColumn('announcement_template_id', 'uuid', (col) => col.references('announcement_template.id').onDelete('cascade'))
      .addUniqueConstraint('unique_announcement_template_per_story', ['story_id', 'announcement_template_id'])
      .execute();

    // Create QuizTemplateAvailableToStory table
    await db.schema.createTable('quiz_template_available_to_story')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`).notNull())
      .addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
      .addColumn('quiz_template_id', 'uuid', (col) => col.references('quiz_template.id').onDelete('cascade'))
      .addUniqueConstraint('unique_quiz_template_per_story', ['story_id', 'quiz_template_id'])
      .execute();

  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async down(db: Kysely<any>) {
    await db.schema.dropTable('quiz_template_available_to_story').ifExists().execute();
    await db.schema.dropTable('announcement_template_available_to_story').ifExists().execute();
    await db.schema.dropTable('video_available_to_story').ifExists().execute();

    await db.schema.dropTable('quiz_logic_rule_input').ifExists().execute();
    await db.schema.dropTable('quiz_logic_rule').ifExists().execute();

    await db.schema.alterTable('part')
      .dropColumn('quiz_logic_for_part_id')
      .execute();

    await db.schema.dropTable('quiz_logic_for_part').ifExists().execute();
    await db.schema.dropTable('part').ifExists().execute();
    await db.schema.dropTable('story').ifExists().execute();
    await db.schema.dropTable('quiz_question_template').ifExists().execute();
    await db.schema.dropTable('quiz_question_template_answer_item').ifExists().execute();
    await db.schema.dropTable('quiz_question_template_answer_group').ifExists().execute();
    await db.schema.dropTable('quiz_template').ifExists().execute();
    await db.schema.dropTable('announcement_template').ifExists().execute();
    await db.schema.dropTable('video').ifExists().execute();

    await db.schema.dropType('logic_hitpolicy').ifExists().execute();
  },
};
