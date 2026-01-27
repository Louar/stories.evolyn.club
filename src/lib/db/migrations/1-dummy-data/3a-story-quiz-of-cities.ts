import { env } from '$env/dynamic/private';
import { db } from '$lib/db/database';
import { type Translatable } from '$lib/db/schemas/0-utils';

export const DummyDataStoryQuizOfCities = async (storyReference: string, clientId?: string, userId?: string) => {

  await db.transaction().execute(async (trx) => {
    // Get the default Client and User
    if (!clientId?.length) clientId = (await trx.selectFrom('client').where('reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).select('id').executeTakeFirstOrThrow()).id;
    if (!userId?.length) userId = (await trx.selectFrom('user').leftJoin('client', 'client.id', 'user.clientId').where('client.reference', '=', env.SECRET_DEFAULT_CLIENT_REFERENCE).where('user.email', '=', env.SECRET_DEFAULT_USER_EMAIL).select('user.id').executeTakeFirstOrThrow()).id;

    // -------------------------
    // 1) Story
    // -------------------------
    const story = await trx
      .insertInto('story')
      .values({
        clientId,
        reference: storyReference,
        name: JSON.stringify({ en: 'Quiz of Cities' } as Translatable),
        configuration: null,
        isPublished: true,
        isPublic: true,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 2) Videos
    // -------------------------
    const videoPlayPause = await trx
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
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoPlayPause.id }).executeTakeFirstOrThrow();

    const videoCountdown = await trx
      .insertInto('video')
      .values({
        name: 'Countdown',
        source: JSON.stringify({ default: '/videos/countdown/stream.m3u8' } as Translatable), // TODO: Fix as type
        // thumbnail: JSON.stringify({ default: '/videos/countdown.jpg' } as Translatable),
        captions: null,
        duration: 10,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoCountdown.id }).executeTakeFirstOrThrow();

    const videoCityBarcelona = await trx
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
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoCityBarcelona.id }).executeTakeFirstOrThrow();

    const videoThumbsDown = await trx
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
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoThumbsDown.id }).executeTakeFirstOrThrow();

    const videoThumbsUp = await trx
      .insertInto('video')
      .values({
        name: 'Thumbs-up',
        source: JSON.stringify({ default: '/videos/thumbs-up/stream.m3u8' } as Translatable), // TODO: Fix as type
        thumbnail: null,
        captions: null,
        duration: 5,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoThumbsUp.id }).executeTakeFirstOrThrow();

    const videoCityLuzern = await trx
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
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoCityLuzern.id }).executeTakeFirstOrThrow();

    const videoGameOver = await trx
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
    await trx.insertInto('videoAvailableToStory').values({ storyId: story.id, videoId: videoGameOver.id }).executeTakeFirstOrThrow();

    // -------------------------
    // 3) Announcement templates
    // -------------------------
    const annWelcome = await trx
      .insertInto('announcementTemplate')
      .values({
        name: 'Welcome to quiz',
        title: JSON.stringify({ en: 'Welcome to the quiz!' } as Translatable),
        message: JSON.stringify({ en: 'And good luck!' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('announcementTemplateAvailableToStory').values({ storyId: story.id, announcementTemplateId: annWelcome.id }).executeTakeFirstOrThrow();

    // -------------------------
    // 4) Quiz templates
    // -------------------------
    const quizPlayPause = await trx
      .insertInto('quizTemplate')
      .values({ name: 'Are you ready?-quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('quizTemplateAvailableToStory').values({ storyId: story.id, quizTemplateId: quizPlayPause.id }).executeTakeFirstOrThrow();

    const quizCityBarcelona = await trx
      .insertInto('quizTemplate')
      .values({ name: 'City of Barcelona quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('quizTemplateAvailableToStory').values({ storyId: story.id, quizTemplateId: quizCityBarcelona.id }).executeTakeFirstOrThrow();

    const quizCityLuzern = await trx
      .insertInto('quizTemplate')
      .values({ name: 'City of Luzern quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('quizTemplateAvailableToStory').values({ storyId: story.id, quizTemplateId: quizCityLuzern.id }).executeTakeFirstOrThrow();

    const quizGameOver = await trx
      .insertInto('quizTemplate')
      .values({ name: 'Game over quiz', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx.insertInto('quizTemplateAvailableToStory').values({ storyId: story.id, quizTemplateId: quizGameOver.id }).executeTakeFirstOrThrow();

    // -------------------------
    // 5) Answer groups
    // -------------------------
    const agPlayPauseQ1 = await trx
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'play-pause-q1', name: 'Yes / No 1', doRandomize: true })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agPlayPauseQ2 = await trx
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'play-pause-q2', name: 'Yes / No 2' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agCityBarcelonaQ1 = await trx
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'city-barcelona-q1', name: 'City options: Barcelona', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agCityLuzernQ1 = await trx
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'city-luzern-q1', name: 'City options: Luzern', doRandomize: false })
      .returning('id')
      .executeTakeFirstOrThrow();

    const agGameOverQ1 = await trx
      .insertInto('quizQuestionTemplateAnswerGroup')
      .values({ reference: 'game-over-q1', name: 'Option to: Start over?' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 6) Answer items (must reference answer groups)
    // -------------------------
    const aiPlayPauseQ1Yes = await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ1.id,
        order: 1,
        value: JSON.stringify(1),
        label: JSON.stringify({ en: 'Yes' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ1.id,
        order: 2,
        value: JSON.stringify(0),
        label: JSON.stringify({ en: 'No' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiPlayPauseQ2Yes = await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ2.id,
        order: 1,
        value: JSON.stringify('YES'),
        label: JSON.stringify({ en: 'Yes' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agPlayPauseQ2.id,
        order: 2,
        value: JSON.stringify('NO'),
        label: JSON.stringify({ en: 'No' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiCityBarcelonaBarcelona = await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 1,
        value: JSON.stringify('Barcelona'),
        label: JSON.stringify({ en: 'Barcelona' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 2,
        value: JSON.stringify('Amsterdam'),
        label: JSON.stringify({ en: 'Amsterdam' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 3,
        value: JSON.stringify('Malaga'),
        label: JSON.stringify({ en: 'Malaga' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityBarcelonaQ1.id,
        order: 4,
        value: JSON.stringify('Bari'),
        label: JSON.stringify({ en: 'Bari' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiCityLuzernLuzern = await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 1,
        value: JSON.stringify('Luzern'),
        label: JSON.stringify({ en: 'Luzern' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 2,
        value: JSON.stringify('Munich'),
        label: JSON.stringify({ en: 'Munich' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 3,
        value: JSON.stringify('Berlin'),
        label: JSON.stringify({ en: 'Berlin' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizQuestionTemplateAnswerItem')
      .values({
        quizQuestionTemplateAnswerGroupId: agCityLuzernQ1.id,
        order: 4,
        value: JSON.stringify('Zurich'),
        label: JSON.stringify({ en: 'Zurich' } as Translatable),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const aiGameOverStartOver = await trx
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
    const qqtPlayPause1 = await trx
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

    const qqtPlayPause2 = await trx
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

    const qqtCityBarcelona1 = await trx
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

    const qqtCityLuzern1 = await trx
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

    const qqtGameOver1 = await trx
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
    // 8) Parts (insert without defaultNextPartId for the forward refs, because several next-part references point to parts not yet created)
    // -------------------------
    const partPlayPause = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ start: 0.05, end: 0.45 }),
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 0.15 }),
        isInitial: true,
        defaultNextPartId: null,
        videoId: videoPlayPause.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later after quiz logic insert
        position: JSON.stringify({ x: 0, y: 0 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCountdown = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ start: 0.5 }),
        foregroundType: 'announcement',
        foregroundConfiguration: JSON.stringify({ start: 0.75 }),
        defaultNextPartId: null, // set later -> city-Barcelona
        videoId: videoCountdown.id,
        announcementTemplateId: annWelcome.id,
        quizLogicForPartId: null,
        position: JSON.stringify({ x: 400, y: -200 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelona = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 1 }),
        defaultNextPartId: null,
        videoId: videoCityBarcelona.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
        position: JSON.stringify({ x: 800, y: 0 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelonaThumbsDown = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 0.5 }),
        foregroundType: null,
        foregroundConfiguration: null,
        defaultNextPartId: null, // set later -> city-Barcelona
        videoId: videoThumbsDown.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
        position: JSON.stringify({ x: 1200, y: 200 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityBarcelonaThumbsUp = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 1 }),
        foregroundType: null,
        foregroundConfiguration: null,
        defaultNextPartId: null, // set later -> city-Luzern
        videoId: videoThumbsUp.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
        position: JSON.stringify({ x: 1200, y: -200 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzern = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 1 }),
        defaultNextPartId: null,
        videoId: videoCityLuzern.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
        position: JSON.stringify({ x: 1600, y: 0 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzernThumbsDown = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 0.4 }),
        foregroundType: null,
        foregroundConfiguration: null,
        defaultNextPartId: null, // set later -> city-Luzern
        videoId: videoThumbsDown.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
        position: JSON.stringify({ x: 2000, y: 200 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partCityLuzernThumbsUp = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: JSON.stringify({ end: 0.8 }),
        foregroundType: null,
        foregroundConfiguration: null,
        defaultNextPartId: null, // set later -> game-over
        videoId: videoThumbsUp.id,
        announcementTemplateId: null,
        quizLogicForPartId: null,
        position: JSON.stringify({ x: 2000, y: -200 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const partGameOver = await trx
      .insertInto('part')
      .values({
        storyId: story.id,
        backgroundType: 'video',
        backgroundConfiguration: null,
        foregroundType: 'quiz',
        foregroundConfiguration: JSON.stringify({ start: 0.5 }),
        defaultNextPartId: null,
        videoId: videoGameOver.id,
        announcementTemplateId: null,
        quizLogicForPartId: null, // set later
        position: JSON.stringify({ x: 2400, y: 0 }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // -------------------------
    // 9) Quiz logic for parts (needs question template + default next part)
    // -------------------------
    const qlPlayPause = await trx
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizPlayPause.id,
        defaultNextPartId: partPlayPause.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlCityBarcelona = await trx
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizCityBarcelona.id,
        defaultNextPartId: partCityBarcelonaThumbsDown.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlCityLuzern = await trx
      .insertInto('quizLogicForPart')
      .values({
        quizTemplateId: quizCityLuzern.id,
        defaultNextPartId: partCityLuzernThumbsDown.id,
        hitpolicy: 'first',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlGameOver = await trx
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
    const qlrPlayPause1 = await trx
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Is ready',
        quizLogicForPartId: qlPlayPause.id,
        nextPartId: partCountdown.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrCityBarcelona1 = await trx
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Correct: Barcelona',
        quizLogicForPartId: qlCityBarcelona.id,
        nextPartId: partCityBarcelonaThumbsUp.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrCityLuzern1 = await trx
      .insertInto('quizLogicRule')
      .values({
        order: 1,
        name: 'Correct: Luzern',
        quizLogicForPartId: qlCityLuzern.id,
        nextPartId: partCityLuzernThumbsUp.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const qlrGameOver1 = await trx
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
    await trx
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrPlayPause1.id,
        quizQuestionTemplateId: qqtPlayPause1.id,
        quizQuestionTemplateAnswerItemId: aiPlayPauseQ1Yes.id,
      })
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrPlayPause1.id,
        quizQuestionTemplateId: qqtPlayPause2.id,
        quizQuestionTemplateAnswerItemId: aiPlayPauseQ2Yes.id,
      })
      .executeTakeFirstOrThrow();

    // city-Barcelona rule 1: correct
    await trx
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrCityBarcelona1.id,
        quizQuestionTemplateId: qqtCityBarcelona1.id,
        quizQuestionTemplateAnswerItemId: aiCityBarcelonaBarcelona.id,
      })
      .executeTakeFirstOrThrow();

    // city-Luzern rule 1: correct
    await trx
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrCityLuzern1.id,
        quizQuestionTemplateId: qqtCityLuzern1.id,
        quizQuestionTemplateAnswerItemId: aiCityLuzernLuzern.id,
      })
      .executeTakeFirstOrThrow();

    // game-over rule 1: start over == true
    await trx
      .insertInto('quizLogicRuleInput')
      .values({
        quizLogicRuleId: qlrGameOver1.id,
        quizQuestionTemplateId: qqtGameOver1.id,
        quizQuestionTemplateAnswerItemId: aiGameOverStartOver.id,
      })
      .executeTakeFirstOrThrow();

    // -------------------------
    // 12) Patch parts: add quizLogicForPartId + default next pointers
    // -------------------------
    await trx
      .updateTable('part')
      .set({
        quizLogicForPartId: qlPlayPause.id,
      })
      .where('id', '=', partPlayPause.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        defaultNextPartId: partCityBarcelona.id,
      })
      .where('id', '=', partCountdown.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        defaultNextPartId: partCityBarcelona.id,
      })
      .where('id', '=', partCityBarcelonaThumbsDown.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        defaultNextPartId: partCityLuzern.id,
      })
      .where('id', '=', partCityBarcelonaThumbsUp.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        quizLogicForPartId: qlCityBarcelona.id,
      })
      .where('id', '=', partCityBarcelona.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        defaultNextPartId: partCityLuzern.id,
      })
      .where('id', '=', partCityLuzernThumbsDown.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        defaultNextPartId: partGameOver.id,
      })
      .where('id', '=', partCityLuzernThumbsUp.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        quizLogicForPartId: qlCityLuzern.id,
      })
      .where('id', '=', partCityLuzern.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('part')
      .set({
        quizLogicForPartId: qlGameOver.id,
      })
      .where('id', '=', partGameOver.id)
      .executeTakeFirstOrThrow();


  });
};