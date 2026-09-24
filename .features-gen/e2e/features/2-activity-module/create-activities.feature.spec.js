// Generated from: e2e/features/2-activity-module/create-activities.feature
import { test } from "../../../../e2e/steps/fixtures.test.ts";

test.describe('Create activities', () => {

  test('Participant Pascal registers a walk through the API', { tag: ['@smoke', '@activity-module'] }, async ({ Given, When, Then, authenticateParticipantPascal, request }) => { 
    await Given('Participant Pascal is authenticated through the API', null, { authenticateParticipantPascal }); 
    await When('Participant Pascal submits a new walk activity with valid details', null, { request }); 
    await Then('Participant Pascal sees the created walk activity in the activities list', null, { request }); 
  });

  test('Participant Pascal registers a run through the UI', { tag: ['@smoke', '@activity-module'] }, async ({ Given, When, Then, And, loginAsParticipantPascal, page }) => { 
    await Given('Participant Pascal is logged in through the UI', null, { loginAsParticipantPascal }); 
    await When('Participant Pascal opens the overview of activities page', null, { page }); 
    await And('Participant Pascal start creating a new run activity', null, { page }); 
    await And('Participant Pascal submits a new run activity with valid details', null, { page }); 
    await Then('Participant Pascal is redirected back to the overview of activities page', null, { page }); 
    await And('Participant Pascal sees the created run activity in the activities list', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/2-activity-module/create-activities.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@smoke","@activity-module"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is authenticated through the API","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"When Participant Pascal submits a new walk activity with valid details","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal sees the created walk activity in the activities list","stepMatchArguments":[]}]},
  {"pwTestLine":12,"pickleLine":9,"tags":["@smoke","@activity-module"],"steps":[{"pwStepLine":13,"gherkinStepLine":10,"keywordType":"Context","textWithKeyword":"Given Participant Pascal is logged in through the UI","stepMatchArguments":[]},{"pwStepLine":14,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When Participant Pascal opens the overview of activities page","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And Participant Pascal start creating a new run activity","stepMatchArguments":[]},{"pwStepLine":16,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"And Participant Pascal submits a new run activity with valid details","stepMatchArguments":[]},{"pwStepLine":17,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then Participant Pascal is redirected back to the overview of activities page","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":15,"keywordType":"Outcome","textWithKeyword":"And Participant Pascal sees the created run activity in the activities list","stepMatchArguments":[]}]},
]; // bdd-data-end