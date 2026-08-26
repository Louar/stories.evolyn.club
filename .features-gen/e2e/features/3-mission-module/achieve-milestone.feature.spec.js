// Generated from: e2e/features/3-mission-module/achieve-milestone.feature
import { test } from "../../../../e2e/steps/fixtures.test.ts";

test.describe('Progress through mission milestones', () => {

  test.beforeEach('Background', async ({ Given, And, authenticateParticipantPascal, request }, testInfo) => { if (testInfo.error) return;
    await Given('Participant Pascal is authenticated through the API', null, { authenticateParticipantPascal }); 
    await And('Participant Pascal joined the mission group "campaign-group"', null, { request }); 
  });
  
  test('Participant Pascal starts at the first milestone', { tag: ['@smoke', '@mission-module'] }, async ({ Then, And, request }) => { 
    await Then('Participant Pascal sees the mission "physically-fit" in the missions list', null, { request }); 
    await And('Participant Pascal sees the milestone "build-endurance" as locked in the mission "physically-fit"', null, { request }); 
  });

  test('Participant Pascal makes progress within the first milestone', { tag: ['@smoke', '@mission-module'] }, async ({ When, Then, request }) => { 
    await When('Participant Pascal completes the "daily-walk" task for the mission "physically-fit"', null, { request }); 
    await Then('Participant Pascal sees progress recorded for the milestone "move-more" in the mission "physically-fit"', null, { request }); 
  });

  test('Participant Pascal does not progress with an activity below the task requirement', { tag: ['@smoke', '@mission-module'] }, async ({ When, Then, And, request }) => { 
    await When('Participant Pascal submits a walk below the "daily-walk" task requirement for the mission "physically-fit"', null, { request }); 
    await Then('Participant Pascal sees no task progress for the milestone "move-more" in the mission "physically-fit"', null, { request }); 
    await And('Participant Pascal sees the milestone "build-endurance" as locked in the mission "physically-fit"', null, { request }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/3-mission-module/achieve-milestone.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":11,"pickleLine":8,"tags":["@smoke","@mission-module"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is authenticated through the API","isBg":true,"stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Context","textWithKeyword":"And Participant Pascal joined the mission group \"campaign-group\"","isBg":true,"stepMatchArguments":[{"group":{"start":44,"value":"\"campaign-group\"","children":[{"start":45,"value":"campaign-group","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal sees the mission \"physically-fit\" in the missions list","stepMatchArguments":[{"group":{"start":36,"value":"\"physically-fit\"","children":[{"start":37,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"And Participant Pascal sees the milestone \"build-endurance\" as locked in the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":38,"value":"\"build-endurance\"","children":[{"start":39,"value":"build-endurance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":81,"value":"\"physically-fit\"","children":[{"start":82,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":16,"pickleLine":12,"tags":["@smoke","@mission-module"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is authenticated through the API","isBg":true,"stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Context","textWithKeyword":"And Participant Pascal joined the mission group \"campaign-group\"","isBg":true,"stepMatchArguments":[{"group":{"start":44,"value":"\"campaign-group\"","children":[{"start":45,"value":"campaign-group","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"When Participant Pascal completes the \"daily-walk\" task for the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":33,"value":"\"daily-walk\"","children":[{"start":34,"value":"daily-walk","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":67,"value":"\"physically-fit\"","children":[{"start":68,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":18,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal sees progress recorded for the milestone \"move-more\" in the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":60,"value":"\"move-more\"","children":[{"start":61,"value":"move-more","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":87,"value":"\"physically-fit\"","children":[{"start":88,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":21,"pickleLine":16,"tags":["@smoke","@mission-module"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is authenticated through the API","isBg":true,"stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Context","textWithKeyword":"And Participant Pascal joined the mission group \"campaign-group\"","isBg":true,"stepMatchArguments":[{"group":{"start":44,"value":"\"campaign-group\"","children":[{"start":45,"value":"campaign-group","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":22,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"When Participant Pascal submits a walk below the \"daily-walk\" task requirement for the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":44,"value":"\"daily-walk\"","children":[{"start":45,"value":"daily-walk","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":90,"value":"\"physically-fit\"","children":[{"start":91,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":23,"gherkinStepLine":18,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal sees no task progress for the milestone \"move-more\" in the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":59,"value":"\"move-more\"","children":[{"start":60,"value":"move-more","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":86,"value":"\"physically-fit\"","children":[{"start":87,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":24,"gherkinStepLine":19,"keywordType":"Outcome","textWithKeyword":"And Participant Pascal sees the milestone \"build-endurance\" as locked in the mission \"physically-fit\"","stepMatchArguments":[{"group":{"start":38,"value":"\"build-endurance\"","children":[{"start":39,"value":"build-endurance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":81,"value":"\"physically-fit\"","children":[{"start":82,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end