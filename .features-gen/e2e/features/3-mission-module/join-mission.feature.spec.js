// Generated from: e2e/features/3-mission-module/join-mission.feature
import { test } from "../../../../e2e/steps/fixtures.test.ts";

test.describe('Join a mission', () => {

  test('Participant Pascal joins a mission through the API', { tag: ['@smoke', '@mission-module'] }, async ({ Given, When, Then, And, authenticateParticipantPascal, request }) => { 
    await Given('Participant Pascal is authenticated through the API', null, { authenticateParticipantPascal }); 
    await And('Participant Pascal is not enrolled in any mission', null, { request }); 
    await When('Participant Pascal joins the group "campaign-group"', null, { request }); 
    await Then('Participant Pascal sees the mission "physically-fit" in the missions list', null, { request }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/3-mission-module/join-mission.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@smoke","@mission-module"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is authenticated through the API","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Context","textWithKeyword":"And Participant Pascal is not enrolled in any mission","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When Participant Pascal joins the group \"campaign-group\"","stepMatchArguments":[{"group":{"start":35,"value":"\"campaign-group\"","children":[{"start":36,"value":"campaign-group","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal sees the mission \"physically-fit\" in the missions list","stepMatchArguments":[{"group":{"start":36,"value":"\"physically-fit\"","children":[{"start":37,"value":"physically-fit","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end