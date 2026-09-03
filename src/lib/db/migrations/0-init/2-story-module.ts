import {
	AnthologyPermissionRole,
	AttributeType,
	LogicHitpolicy,
	StoryPermissionRole
} from '$lib/db/schemas/2-story-module';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

export const InitStoryModule: Migration = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async up(db: Kysely<any>) {
		// Create Types
		await db.schema.dropType('logic_hitpolicy').ifExists().execute();
		await db.schema.createType('logic_hitpolicy').asEnum(Object.values(LogicHitpolicy)).execute();
		await db.schema.dropType('anthology_permission_role').ifExists().execute();
		await db.schema
			.createType('anthology_permission_role')
			.asEnum(Object.values(AnthologyPermissionRole))
			.execute();
		await db.schema.dropType('story_permission_role').ifExists().execute();
		await db.schema
			.createType('story_permission_role')
			.asEnum(Object.values(StoryPermissionRole))
			.execute();
		await db.schema.dropType('attribute_type').ifExists().execute();
		await db.schema.createType('attribute_type').asEnum(Object.values(AttributeType)).execute();

		// Create Video table
		await db.schema
			.createTable('video')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('source', 'jsonb', (col) => col.notNull())
			.addColumn('thumbnail', 'jsonb')
			.addColumn('captions', 'jsonb')
			.addColumn('duration', 'smallint', (col) => col.notNull())
			.execute();

		// Create Still table
		await db.schema
			.createTable('still')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('color', 'text')
			.addColumn('image', 'jsonb')
			.addColumn('style', 'text')
			.execute();

		// Create AnnouncementTemplate table
		await db.schema
			.createTable('announcement_template')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('title', 'jsonb')
			.addColumn('message', 'jsonb')
			.execute();

		// Create QuizTemplate table
		await db.schema
			.createTable('quiz_template')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('do_randomize', 'boolean', (col) => col.defaultTo(false).notNull())
			.execute();

		// Create QuizQuestionTemplateAnswerGroup table
		await db.schema
			.createTable('quiz_question_template_answer_group')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('slug', 'text')
			.addColumn('name', 'text')
			.addColumn('do_randomize', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('is_global', 'boolean', (col) => col.defaultTo(false).notNull())
			.execute();

		// Create QuizQuestionTemplateAnswerItem table
		await db.schema
			.createTable('quiz_question_template_answer_item')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('quiz_question_template_answer_group_id', 'uuid', (col) =>
				col.references('quiz_question_template_answer_group.id').onDelete('cascade').notNull()
			)
			.addColumn('order', 'smallint', (col) => col.notNull())
			.addColumn('value', 'jsonb', (col) => col.notNull())
			.addColumn('label', 'jsonb', (col) => col.notNull())
			.execute();

		// Create QuizQuestionTemplate table
		await db.schema
			.createTable('quiz_question_template')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('quiz_template_id', 'uuid', (col) =>
				col.references('quiz_template.id').onDelete('cascade').notNull()
			)
			.addColumn('order', 'smallint', (col) => col.notNull())
			.addColumn('answer_template_slug', 'text', (col) => col.notNull())
			.addColumn('title', 'jsonb', (col) => col.notNull())
			.addColumn('instruction', 'jsonb')
			.addColumn('placeholder', 'jsonb')
			.addColumn('configuration', 'jsonb')
			.addColumn('is_required', 'boolean', (col) => col.defaultTo(true).notNull())
			.addColumn('quiz_question_template_answer_group_id', 'uuid', (col) =>
				col.references('quiz_question_template_answer_group.id').onDelete('cascade')
			)
			.execute();

		// Create Story table
		await db.schema
			.createTable('story')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('client_id', 'uuid', (col) =>
				col.references('client.id').onDelete('cascade').notNull()
			)
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('name', 'jsonb', (col) => col.notNull())
			.addColumn('default_background_color', 'text')
			.addColumn('thumbnail', 'jsonb')
			.addColumn('configuration', 'jsonb')
			.addColumn('is_published', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('is_public', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addColumn('updated_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addUniqueConstraint('unique_story_per_client', ['client_id', 'slug'])
			.execute();

		// Create Story Permission table
		await db.schema
			.createTable('story_permission')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) =>
				col.references('story.id').onDelete('cascade').notNull()
			)
			.addColumn('user_id', 'uuid', (col) =>
				col.references('user.id').onDelete('cascade').notNull()
			)
			.addColumn('role', sql`story_permission_role`, (col) =>
				col.defaultTo(StoryPermissionRole.owner).notNull()
			)
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addColumn('updated_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addUniqueConstraint('unique_permission_per_story_and_user', ['story_id', 'user_id'])
			.execute();

		// Create the Story Auth Code table
		await db.schema
			.createTable('story_auth_code')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) =>
				col.references('client.id').onDelete('cascade').notNull()
			)
			.addColumn('value', 'text', (col) => col.notNull())
			.addColumn('used_at', 'timestamptz')
			.addUniqueConstraint('unique_value_per_story', ['story_id', 'value'])
			.execute();

		// Create Part table
		await db.schema
			.createTable('part')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) =>
				col.references('story.id').onDelete('cascade').notNull()
			)
			.addColumn('background_type', 'text')
			.addColumn('background_configuration', 'jsonb')
			.addColumn('foreground_type', 'text')
			.addColumn('foreground_configuration', 'jsonb')
			.addColumn('is_initial', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('default_next_part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('set null')
			)
			.addColumn('still_id', 'uuid', (col) => col.references('still.id').onDelete('set null'))
			.addColumn('video_id', 'uuid', (col) => col.references('video.id').onDelete('set null'))
			.addColumn('announcement_template_id', 'uuid', (col) =>
				col.references('announcement_template.id').onDelete('set null')
			)
			.addColumn('position', 'jsonb')
			.execute();

		// Create QuizLogicForPart table
		await db.schema
			.createTable('quiz_logic_for_part')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('quiz_template_id', 'uuid', (col) =>
				col.references('quiz_template.id').onDelete('cascade').notNull()
			)
			.addColumn('default_next_part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('set null')
			)
			.addColumn('hitpolicy', sql`logic_hitpolicy`, (col) =>
				col.defaultTo(LogicHitpolicy.first).notNull()
			)
			.execute();

		await db.schema
			.alterTable('part')
			.addColumn('quiz_logic_for_part_id', 'uuid', (col) =>
				col.references('quiz_logic_for_part.id').onDelete('set null')
			)
			.execute();

		// Create QuizLogicRule table
		await db.schema
			.createTable('quiz_logic_rule')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('order', 'smallint', (col) => col.notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('quiz_logic_for_part_id', 'uuid', (col) =>
				col.references('quiz_logic_for_part.id').onDelete('cascade').notNull()
			)
			.addColumn('next_part_id', 'uuid', (col) => col.references('part.id').onDelete('cascade'))
			.execute();

		// Create QuizLogicRuleInput table
		await db.schema
			.createTable('quiz_logic_rule_input')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('quiz_logic_rule_id', 'uuid', (col) =>
				col.references('quiz_logic_rule.id').onDelete('cascade').notNull()
			)
			.addColumn('quiz_question_template_id', 'uuid', (col) =>
				col.references('quiz_question_template.id').onDelete('cascade').notNull()
			)
			.addColumn('quiz_question_template_answer_item_id', 'uuid', (col) =>
				col.references('quiz_question_template_answer_item.id').onDelete('cascade')
			)
			.addColumn('value', 'jsonb')
			.execute();

		// Create VideoAvailableToStory table
		await db.schema
			.createTable('video_available_to_story')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
			.addColumn('video_id', 'uuid', (col) => col.references('video.id').onDelete('cascade'))
			.addUniqueConstraint('unique_video_per_story', ['story_id', 'video_id'])
			.execute();

		// Create StillAvailableToStory table
		await db.schema
			.createTable('still_available_to_story')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
			.addColumn('still_id', 'uuid', (col) => col.references('still.id').onDelete('cascade'))
			.addUniqueConstraint('unique_still_per_story', ['story_id', 'still_id'])
			.execute();

		// Create AnnouncementTemplateAvailableToStory table
		await db.schema
			.createTable('announcement_template_available_to_story')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
			.addColumn('announcement_template_id', 'uuid', (col) =>
				col.references('announcement_template.id').onDelete('cascade')
			)
			.addUniqueConstraint('unique_announcement_template_per_story', [
				'story_id',
				'announcement_template_id'
			])
			.execute();

		// Create QuizTemplateAvailableToStory table
		await db.schema
			.createTable('quiz_template_available_to_story')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('story_id', 'uuid', (col) => col.references('story.id').onDelete('cascade'))
			.addColumn('quiz_template_id', 'uuid', (col) =>
				col.references('quiz_template.id').onDelete('cascade')
			)
			.addUniqueConstraint('unique_quiz_template_per_story', ['story_id', 'quiz_template_id'])
			.execute();

		// Create Anthology table
		await db.schema
			.createTable('anthology')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('client_id', 'uuid', (col) =>
				col.references('client.id').onDelete('cascade').notNull()
			)
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('name', 'jsonb', (col) => col.notNull())
			.addColumn('configuration', 'jsonb')
			.addColumn('is_published', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('is_public', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addColumn('updated_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addUniqueConstraint('unique_anthology_per_client', ['client_id', 'slug'])
			.execute();

		// Create Anthology Permission table
		await db.schema
			.createTable('anthology_permission')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('anthology_id', 'uuid', (col) =>
				col.references('anthology.id').onDelete('cascade').notNull()
			)
			.addColumn('user_id', 'uuid', (col) =>
				col.references('user.id').onDelete('cascade').notNull()
			)
			.addColumn('role', sql`anthology_permission_role`, (col) =>
				col.defaultTo(AnthologyPermissionRole.owner).notNull()
			)
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addColumn('updated_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addUniqueConstraint('unique_permission_per_anthology_and_user', ['anthology_id', 'user_id'])
			.execute();

		// Create AnthologyPosition table
		await db.schema
			.createTable('anthology_position')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('anthology_id', 'uuid', (col) =>
				col.references('anthology.id').onDelete('cascade').notNull()
			)
			.addColumn('story_id', 'uuid', (col) =>
				col.references('story.id').onDelete('cascade').notNull()
			)
			.addColumn('order', 'smallint', (col) => col.notNull())
			.addColumn('configuration', 'jsonb')
			.addUniqueConstraint('unique_story_per_position_in_anthology', [
				'anthology_id',
				'story_id',
				'order'
			])
			.execute();

		// Create EventTransition table
		await db.schema
			.createTable('event_transition')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('url', 'text', (col) => col.notNull())
			.addColumn('session', 'text', (col) => col.notNull())
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('from_part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('cascade').notNull()
			)
			.addColumn('to_part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('cascade').notNull()
			)
			.execute();

		// Create EventInteraction table
		await db.schema
			.createTable('event_interaction')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('url', 'text', (col) => col.notNull())
			.addColumn('session', 'text', (col) => col.notNull())
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('cascade').notNull()
			)
			.addColumn('quiz_question_template_id', 'uuid', (col) =>
				col.references('quiz_question_template.id').onDelete('cascade').notNull()
			)
			.addColumn('quiz_question_template_answer_item_id', 'uuid', (col) =>
				col.references('quiz_question_template_answer_item.id').onDelete('cascade')
			)
			.addColumn('value', 'jsonb')
			.execute();

		await db.schema
			.createTable('taxonomy')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('client_id', 'uuid', (col) =>
				col.references('client.id').onDelete('cascade').notNull()
			)
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('name', 'jsonb')
			.addColumn('description', 'jsonb')
			.addUniqueConstraint('unique_taxonomy_per_client', ['client_id', 'slug'])
			.execute();

		await db.schema
			.createTable('category')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('taxonomy_id', 'uuid', (col) =>
				col.references('taxonomy.id').onDelete('cascade').notNull()
			)
			.addColumn('name', 'jsonb', (col) => col.notNull())
			.addColumn('image', 'jsonb')
			.addColumn('description', 'jsonb')
			.addColumn('map', 'jsonb')
			.execute();

		await db.schema
			.createTable('attribute')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('taxonomy_id', 'uuid', (col) =>
				col.references('taxonomy.id').onDelete('cascade').notNull()
			)
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('name', 'jsonb', (col) => col.notNull())
			.addColumn('image', 'jsonb')
			.addColumn('description', 'jsonb')
			.addColumn('type', sql`attribute_type`, (col) => col.notNull())
			.addColumn('referenced_category_id', 'uuid', (col) =>
				col.references('category.id').onDelete('set null')
			)
			.addColumn('schema', 'json')
			.addUniqueConstraint('unique_attribute_per_taxonomy', ['slug', 'taxonomy_id'])
			.execute();

		await db.schema
			.createTable('attribute_of_category')
			.ifNotExists()
			.addColumn('category_id', 'uuid', (col) =>
				col.references('category.id').onDelete('cascade').notNull()
			)
			.addColumn('attribute_id', 'uuid', (col) =>
				col.references('attribute.id').onDelete('cascade').notNull()
			)
			.addColumn('order', 'smallint')
			.addColumn('is_required', 'boolean', (col) => col.defaultTo(false).notNull())
			.addColumn('is_default', 'boolean', (col) => col.defaultTo(false).notNull())
			.addPrimaryKeyConstraint('attribute_of_category_pkey', ['category_id', 'attribute_id'])
			.execute();

		await db.schema
			.createTable('item')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('taxonomy_id', 'uuid', (col) =>
				col.references('taxonomy.id').onDelete('cascade').notNull()
			)
			// .addColumn('name', 'jsonb')
			// .addColumn('image', 'jsonb')
			// .addColumn('description', 'jsonb')
			// .addColumn('emoji', 'text')
			// .addColumn('outline', 'jsonb')
			.execute();

		await db.schema
			.createTable('item_of_category')
			.ifNotExists()
			.addColumn('item_id', 'uuid', (col) =>
				col.references('item.id').onDelete('cascade').notNull()
			)
			.addColumn('category_id', 'uuid', (col) =>
				col.references('category.id').onDelete('cascade').notNull()
			)
			.addPrimaryKeyConstraint('item_of_category_pkey', ['item_id', 'category_id'])
			.execute();

		await db.schema
			.createTable('attribute_of_item')
			.ifNotExists()
			.addColumn('item_id', 'uuid', (col) =>
				col.references('item.id').onDelete('cascade').notNull()
			)
			.addColumn('attribute_id', 'uuid', (col) =>
				col.references('attribute.id').onDelete('cascade').notNull()
			)
			.addColumn('value', 'jsonb')
			.addColumn('referenced_item_id', 'uuid', (col) =>
				col.references('item.id').onDelete('set null')
			)
			.addColumn('difficulty', 'smallint')
			.addPrimaryKeyConstraint('attribute_of_item_pkey', ['item_id', 'attribute_id'])
			.execute();

		await db.schema
			.createTable('taxonomy_draft_for_part')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('taxonomy_id', 'uuid', (col) =>
				col.references('taxonomy.id').onDelete('cascade').notNull()
			)
			.addColumn('nr_of_rounds', 'smallint')
			.addColumn('nr_of_items_per_round', 'smallint')
			.addColumn('goal', 'smallint')
			.addColumn('max_mistakes', 'smallint')
			.addColumn('difficulty', 'smallint')
			.addColumn('default_next_part_id', 'uuid', (col) =>
				col.references('part.id').onDelete('set null')
			)
			.addColumn('created_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.addColumn('updated_at', 'timestamptz', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.addColumn('updated_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
			.execute();

		await db.schema
			.createTable('taxonomy_draft_logic_rule')
			.ifNotExists()
			.addColumn('id', 'uuid', (col) =>
				col
					.primaryKey()
					.defaultTo(sql`uuidv7()`)
					.notNull()
			)
			.addColumn('taxonomy_draft_for_part_id', 'uuid', (col) =>
				col.references('taxonomy_draft_for_part.id').onDelete('cascade').notNull()
			)
			.addColumn('order', 'smallint', (col) => col.notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('nr_of_rounds', 'jsonb')
			.addColumn('score', 'jsonb')
			.addColumn('mistakes', 'jsonb')
			.addColumn('duration', 'jsonb')
			.addColumn('next_part_id', 'uuid', (col) => col.references('part.id').onDelete('set null'))
			.execute();

		await db.schema
			.alterTable('part')
			.addColumn('taxonomy_draft_for_part_id', 'uuid', (col) =>
				col.references('taxonomy_draft_for_part.id').onDelete('set null')
			)
			.execute();

		await db.schema
			.createTable('drafted_attribute')
			.ifNotExists()
			.addColumn('taxonomy_draft_for_part_id', 'uuid', (col) =>
				col.references('taxonomy_draft_for_part.id').onDelete('cascade').notNull()
			)
			.addColumn('attribute_id', 'uuid', (col) =>
				col.references('attribute.id').onDelete('cascade').notNull()
			)
			.addPrimaryKeyConstraint('drafted_attribute_pkey', [
				'taxonomy_draft_for_part_id',
				'attribute_id'
			])
			.execute();

		await db.schema
			.createTable('drafted_category')
			.ifNotExists()
			.addColumn('taxonomy_draft_for_part_id', 'uuid', (col) =>
				col.references('taxonomy_draft_for_part.id').onDelete('cascade').notNull()
			)
			.addColumn('category_id', 'uuid', (col) =>
				col.references('category.id').onDelete('cascade').notNull()
			)
			.addPrimaryKeyConstraint('drafted_category_pkey', [
				'taxonomy_draft_for_part_id',
				'category_id'
			])
			.execute();

		await db.schema
			.createTable('drafted_item')
			.ifNotExists()
			.addColumn('taxonomy_draft_for_part_id', 'uuid', (col) =>
				col.references('taxonomy_draft_for_part.id').onDelete('cascade').notNull()
			)
			.addColumn('item_id', 'uuid', (col) =>
				col.references('item.id').onDelete('cascade').notNull()
			)
			.addPrimaryKeyConstraint('drafted_item_pkey', ['taxonomy_draft_for_part_id', 'item_id'])
			.execute();
	},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async down(db: Kysely<any>) {
		await db.schema.dropTable('event_interaction').ifExists().execute();
		await db.schema.dropTable('event_transition').ifExists().execute();

		await db.schema.dropTable('anthology_position').ifExists().execute();
		await db.schema.dropTable('anthology_permission').ifExists().execute();
		await db.schema.dropTable('anthology').ifExists().execute();

		await db.schema.dropTable('quiz_template_available_to_story').ifExists().execute();
		await db.schema.dropTable('announcement_template_available_to_story').ifExists().execute();
		await db.schema.dropTable('still_available_to_story').ifExists().execute();
		await db.schema.dropTable('video_available_to_story').ifExists().execute();

		await db.schema.dropTable('quiz_logic_rule_input').ifExists().execute();
		await db.schema.dropTable('quiz_logic_rule').ifExists().execute();

		await db.schema.alterTable('part').dropColumn('quiz_logic_for_part_id').execute();

		await db.schema.dropTable('quiz_logic_for_part').ifExists().execute();

		await db.schema.alterTable('part').dropColumn('taxonomy_draft_for_part_id').execute();
		await db.schema.dropTable('drafted_item').ifExists().execute();
		await db.schema.dropTable('drafted_category').ifExists().execute();
		await db.schema.dropTable('drafted_attribute').ifExists().execute();
		await db.schema.dropTable('taxonomy_draft_logic_rule').ifExists().execute();
		await db.schema.dropTable('taxonomy_draft_for_part').ifExists().execute();

		await db.schema.dropTable('part').ifExists().execute();
		await db.schema.dropTable('story_auth_code').ifExists().execute();
		await db.schema.dropTable('story_permission').ifExists().execute();
		await db.schema.dropTable('story').ifExists().execute();
		await db.schema.dropTable('quiz_question_template').ifExists().execute();
		await db.schema.dropTable('quiz_question_template_answer_item').ifExists().execute();
		await db.schema.dropTable('quiz_question_template_answer_group').ifExists().execute();
		await db.schema.dropTable('quiz_template').ifExists().execute();
		await db.schema.dropTable('announcement_template').ifExists().execute();
		await db.schema.dropTable('still').ifExists().execute();
		await db.schema.dropTable('video').ifExists().execute();
		await db.schema.dropTable('attribute_of_item').ifExists().execute();
		await db.schema.dropTable('item_of_category').ifExists().execute();
		await db.schema.dropTable('item').ifExists().execute();
		await db.schema.dropTable('attribute_of_category').ifExists().execute();
		await db.schema.dropTable('attribute').ifExists().execute();
		await db.schema.dropTable('category').ifExists().execute();
		await db.schema.dropTable('taxonomy').ifExists().execute();

		await db.schema.dropType('logic_hitpolicy').ifExists().execute();
		await db.schema.dropType('anthology_permission_role').ifExists().execute();
		await db.schema.dropType('story_permission_role').ifExists().execute();
		await db.schema.dropType('attribute_type').ifExists().execute();
	}
};
