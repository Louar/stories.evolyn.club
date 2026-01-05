import { env } from '$env/dynamic/private';
import type { Schema } from '$lib/db/schema';
import { type Translatable } from '$lib/db/schemas/0-utils';
import type { Kysely, Migration } from 'kysely';

export const DummyDataDefaultStory: Migration = {
  async up(db: Kysely<Schema>) {

    // Get the default Client and User
    const clientId = (await db.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;
    const userId = (await db.selectFrom('user').leftJoin('client', 'client.id', 'user.clientId').where('client.reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).where('user.email', '=', env.SECRET_DEFAULT_USER_EMAIL).select('user.id').executeTakeFirstOrThrow()).id;

    // -------------------------
    // 1) Story
    // -------------------------
    const story = await db
      .insertInto('story')
      .values({
        clientId,
        reference: 'quiz-of-cities',
        name: 'Quiz of Cities',
        configuration: null,
        isPublished: false,
        isPublic: false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 2) Videos
    // -------------------------
    const videoPlayPause = await db
      .insertInto('video')
      .values({
        name: 'Play/Pause',
        source: JSON.stringify({ default: '/videos/play-pause/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: JSON.stringify({ default: '/videos/play-pause.jpg' } as Translatable), // TODO: Fix as type
        captions: null,
        duration: 15,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoCountdown = await db
      .insertInto('video')
      .values({
        name: 'Countdown',
        source: JSON.stringify({ default: '/videos/countdown/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: JSON.stringify({ default: '/videos/countdown.jpg' } as Translatable), // TODO: Fix as type
        captions: null,
        duration: 10,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoCityBarcelona = await db
      .insertInto('video')
      .values({
        name: 'City of Barcelona',
        source: JSON.stringify({ default: '/videos/city-Barcelona/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 5,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoThumbsDown = await db
      .insertInto('video')
      .values({
        name: 'Thumbs-down',
        source: JSON.stringify({ default: '/videos/thumbs-down/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 9,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoThumbsUp = await db
      .insertInto('video')
      .values({
        name: 'Tthumbs-up',
        source: JSON.stringify({ default: '/videos/thumbs-up/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 5,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoCityLuzern = await db
      .insertInto('video')
      .values({
        name: 'City of Luzern',
        source: JSON.stringify({ default: '/videos/city-Luzern/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 5,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const videoGameOver = await db
      .insertInto('video')
      .values({
        name: 'Game over',
        source: JSON.stringify({ default: '/videos/game-over/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 10,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 3) Announcement templates
    // -------------------------
    const annWelcome = await db
      .insertInto('announcementTemplate')
      .values({
        name: 'Welcome to quiz',
        title: JSON.stringify({ en: 'Welcome to the quiz!' } as Translatable),
        message: JSON.stringify({ en: 'And good luck!' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 4) Quiz templates
    // -------------------------
    const quizPlayPause = await db
      .insertInto('quizTemplate')
      .values({ name: 'Are you ready?-quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();

    const quizCityBarcelona = await db
      .insertInto('quizTemplate')
      .values({ name: 'City of Barcelona quiz', doRandomize: true })
      .returning('id')
      .executeTakeFirstOrThrow();

    const quizCityLuzern = await db
      .insertInto('quizTemplate')
      .values({ name: 'City of Luzern quiz', doRandomize: true })
      .returning('id')
      .executeTakeFirstOrThrow();

    const quizGameOver = await db
      .insertInto('quizTemplate')
      .values({ name: 'Game over quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 5) Answer groups
    // -------------------------
    const agPlayPauseQ1 = await db
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'play-pause-q1', name: 'Are you ready?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agPlayPauseQ2 = await db
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'play-pause-q2', name: 'Are you sure?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agCityBarcelonaQ1 = await db
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'city-barcelona-q1', name: 'Which city is this?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agCityLuzernQ1 = await db
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'city-luzern-q1', name: 'Which city is this?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agGameOverQ1 = await db
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'game-over-q1', name: 'Start over?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 6) Answer items (must reference answer groups)
    // -------------------------
    const aiPlayPauseQ1Yes = await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ1.id,
        order: 1,
        value: JSON.stringify(1),
        label: JSON.stringify({ en: 'Yes' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ1.id,
        order: 2,
        value: JSON.stringify(0),
        label: JSON.stringify({ en: 'No' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiPlayPauseQ2Yes = await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ2.id,
        order: 1,
        value: JSON.stringify('YES'),
        label: JSON.stringify({ en: 'Yes' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ2.id,
        order: 2,
        value: JSON.stringify('NO'),
        label: JSON.stringify({ en: 'No' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiCityBarcelonaBarcelona = await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 1,
        value: JSON.stringify('Barcelona'),
        label: JSON.stringify({ en: 'Barcelona' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 2,
        value: JSON.stringify('Amsterdam'),
        label: JSON.stringify({ en: 'Amsterdam' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 3,
        value: JSON.stringify('Malaga'),
        label: JSON.stringify({ en: 'Malaga' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 4,
        value: JSON.stringify('Bari'),
        label: JSON.stringify({ en: 'Bari' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiCityLuzernLuzern = await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 1,
        value: JSON.stringify('Luzern'),
        label: JSON.stringify({ en: 'Luzern' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 2,
        value: JSON.stringify('Munich'),
        label: JSON.stringify({ en: 'Munich' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 3,
        value: JSON.stringify('Berlin'),
        label: JSON.stringify({ en: 'Berlin' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 4,
        value: JSON.stringify('Zurich'),
        label: JSON.stringify({ en: 'Zurich' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiGameOverStartOver = await db
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agGameOverQ1.id,
        order: 1,
        value: JSON.stringify(true),
        label: JSON.stringify({ en: 'Start over' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 7) Question templates (must reference quiz template + maybe answer group)
    // -------------------------
    const qqtPlayPause1 = await db
      .insertInto('quizQuestionTemplate')
      .values({
        quizTemplateId: quizPlayPause.id,
        order: 1,
        answerTemplateReference: 'select-single',
        title: JSON.stringify({ en: 'Are you ready?' } as Translatable),
        instruction: null,
        placeholder: null,
        configuration: null,
        isRequired: true,
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ1.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qqtPlayPause2 = await db
      .insertInto('quizQuestionTemplate')
      .values({
        quizTemplateId: quizPlayPause.id,
        order: 2,
        answerTemplateReference: 'select-single',
        title: JSON.stringify({ en: 'Are you sure?' } as Translatable),
        instruction: null,
        placeholder: null,
        configuration: null,
        isRequired: true,
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ2.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qqtCityBarcelona1 = await db
      .insertInto('quizQuestionTemplate')
      .values({
        quizTemplateId: quizCityBarcelona.id,
        order: 1,
        answerTemplateReference: 'select-single',
        title: JSON.stringify({ en: 'Which city is this?' } as Translatable),
        instruction: null,
        placeholder: null,
        configuration: null,
        isRequired: true,
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qqtCityLuzern1 = await db
      .insertInto('quizQuestionTemplate')
      .values({
        quizTemplateId: quizCityLuzern.id,
        order: 1,
        answerTemplateReference: 'select-single',
        title: JSON.stringify({ en: 'Which city is this?' } as Translatable),
        instruction: null,
        placeholder: null,
        configuration: null,
        isRequired: true,
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qqtGameOver1 = await db
      .insertInto('quizQuestionTemplate')
      .values({
        quizTemplateId: quizGameOver.id,
        order: 1,
        answerTemplateReference: 'select-single',
        title: JSON.stringify({ en: 'Start over?' } as Translatable),
        instruction: null,
        placeholder: null,
        configuration: null,
        isRequired: true,
        quizQuestionTemplateAnswerGroupId: agGameOverQ1.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 8) Parts (insert without defaultNextPartId for the forward refs)
    //    (because several next-part references point to parts not yet created)
    // -------------------------
    const partPlayPause = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ start: 0.05, end: 0.45 }),
        duration: 6,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 0.5 }),
        isInitial: true,
        isFinal: false,
        defaultNextPartId: null,
        videoId: videoPlayPause.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later after quiz logic insert
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCountdown = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ start: 0.5 }),
        duration: 5,
        foregroundType: 'announcement',
        foregroundConfiguration: JSON.stringify({ start: 0.5 }),
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null, // set later -> city-Barcelona
        videoId: videoCountdown.id,
        announcementTemplateId: annWelcome.id,
        quizLogicForPartId: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelona = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        duration: 5,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 1 }),
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null,
        videoId: videoCityBarcelona.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelonaThumbsDown = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 0.5 }),
        duration: 5,
        foregroundType: null,
        foregroundConfiguration: null,
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null, // set later -> city-Barcelona
        videoId: videoThumbsDown.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelonaThumbsUp = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 1 }),
        foregroundType: null,
        foregroundConfiguration: null,
        duration: 5,
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null, // set later -> city-Luzern
        videoId: videoThumbsUp.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzern = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        duration: 5,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 1 }),
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null,
        videoId: videoCityLuzern.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzernThumbsDown = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 0.333, playbackRate: 2 }),
        duration: 6,
        foregroundType: null,
        foregroundConfiguration: null,
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null, // set later -> city-Luzern
        videoId: videoThumbsDown.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzernThumbsUp = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 1 }),
        duration: 5,
        foregroundType: null,
        foregroundConfiguration: null,
        isInitial: false,
        isFinal: false,
        defaultNextPartId: null, // set later -> game-over
        videoId: videoThumbsUp.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partGameOver = await db
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        duration: 10,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 0.5 }),
        isInitial: false,
        isFinal: true,
        defaultNextPartId: null,
        videoId: videoGameOver.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 9) Quiz logic for parts (needs question template + default next part)
    // -------------------------
    const qlPlayPause = await db
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizPlayPause.id,
        defaultNextPartId: partPlayPause.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlCityBarcelona = await db
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizCityBarcelona.id,
        defaultNextPartId: partCityBarcelonaThumbsDown.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlCityLuzern = await db
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizCityLuzern.id,
        defaultNextPartId: partCityLuzernThumbsDown.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlGameOver = await db
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizGameOver.id,
        defaultNextPartId: null,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 10) Quiz logic rules (needs quizLogicForPart + next part)
    // -------------------------
    const qlrPlayPause1 = await db
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Is ready',
        quizLogicForPartId: qlPlayPause.id,
        nextPartId: partCountdown.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Default: Not ready -> back to play-pause
    await db
      .insertInto('quizLogicRule')
      .values({
        order: 2,
        name: 'Default: Not ready',
        quizLogicForPartId: qlPlayPause.id,
        nextPartId: partPlayPause.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrCityBarcelona1 = await db
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Correct: Barcelona',
        quizLogicForPartId: qlCityBarcelona.id,
        nextPartId: partCityBarcelonaThumbsUp.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizLogicRule')
      .values({
        order: 2,
        name: 'Default: Not correct',
        quizLogicForPartId: qlCityBarcelona.id,
        nextPartId: partCityBarcelonaThumbsDown.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrCityLuzern1 = await db
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Correct: Luzern',
        quizLogicForPartId: qlCityLuzern.id,
        nextPartId: partCityLuzernThumbsUp.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizLogicRule')
      .values({
        order: 2,
        name: 'Default: Not correct',
        quizLogicForPartId: qlCityLuzern.id,
        nextPartId: partCityLuzernThumbsDown.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrGameOver1 = await db
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Game over',
        quizLogicForPartId: qlGameOver.id,
        nextPartId: partPlayPause.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 11) Rule inputs (needs rule + question template + (optionally) answer item)
    // -------------------------
    // play-pause rule 1: interaction_1 == 1 AND interaction_2 == "YES"
    await db
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrPlayPause1.id,
        quizQuestionTemplateId: qqtPlayPause1.id,
        quizQuestionTemplateAnswerItemId: aiPlayPauseQ1Yes.id,
        value: JSON.stringify(1),
      })
      .executeTakeFirstOrThrow();

    await db
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrPlayPause1.id,
        quizQuestionTemplateId: qqtPlayPause2.id,
        quizQuestionTemplateAnswerItemId: aiPlayPauseQ2Yes.id,
        value: JSON.stringify('YES'),
      })
      .executeTakeFirstOrThrow();

    // city-Barcelona rule 1: correct
    await db
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrCityBarcelona1.id,
        quizQuestionTemplateId: qqtCityBarcelona1.id,
        quizQuestionTemplateAnswerItemId: aiCityBarcelonaBarcelona.id,
        value: JSON.stringify('Barcelona'),
      })
      .executeTakeFirstOrThrow();

    // city-Luzern rule 1: correct
    await db
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrCityLuzern1.id,
        quizQuestionTemplateId: qqtCityLuzern1.id,
        quizQuestionTemplateAnswerItemId: aiCityLuzernLuzern.id,
        value: JSON.stringify('Luzern'),
      })
      .executeTakeFirstOrThrow();

    // game-over rule 1: start over == true
    await db
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrGameOver1.id,
        quizQuestionTemplateId: qqtGameOver1.id,
        quizQuestionTemplateAnswerItemId: aiGameOverStartOver.id,
        value: JSON.stringify(true),
      })
      .executeTakeFirstOrThrow();

    // -------------------------
    // 12) Patch parts: add quizLogicForPartId + default next pointers
    // -------------------------
    await db
      .updateTable('part')
      .set({
        quizLogicForPartId: qlPlayPause.id,
      })
      .where('id', '=', partPlayPause.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        defaultNextPartId: partCityBarcelona.id,
      })
      .where('id', '=', partCountdown.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        defaultNextPartId: partCityBarcelona.id,
      })
      .where('id', '=', partCityBarcelonaThumbsDown.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        defaultNextPartId: partCityLuzern.id,
      })
      .where('id', '=', partCityBarcelonaThumbsUp.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        quizLogicForPartId: qlCityBarcelona.id,
      })
      .where('id', '=', partCityBarcelona.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        defaultNextPartId: partCityLuzern.id,
      })
      .where('id', '=', partCityLuzernThumbsDown.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        defaultNextPartId: partGameOver.id,
      })
      .where('id', '=', partCityLuzernThumbsUp.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        quizLogicForPartId: qlCityLuzern.id,
      })
      .where('id', '=', partCityLuzern.id)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('part')
      .set({
        quizLogicForPartId: qlGameOver.id,
      })
      .where('id', '=', partGameOver.id)
      .executeTakeFirstOrThrow();


  },
  async down() {
    // db: Kysely<Schema>

  },
};