@smoke @activity-module
Feature: Create activities

	Scenario: Participant Pascal registers a walk through the API
		Given Participant Pascal is authenticated through the API
		When Participant Pascal submits a new walk activity with valid details
		Then Participant Pascal sees the created walk activity in the activities list

	Scenario: Participant Pascal registers a run through the UI
		Given Participant Pascal is logged in through the UI
		When Participant Pascal opens the overview of activities page
		And Participant Pascal start creating a new run activity
		And Participant Pascal submits a new run activity with valid details
		Then Participant Pascal is redirected back to the overview of activities page
		And Participant Pascal sees the created run activity in the activities list
