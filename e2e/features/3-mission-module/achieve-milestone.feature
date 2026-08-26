@smoke @mission-module
Feature: Progress through mission milestones

  Background:
    Given Participant Pascal is authenticated through the API
    And Participant Pascal joined the mission group "campaign-group"

  Scenario: Participant Pascal starts at the first milestone
    Then Participant Pascal sees the mission "physically-fit" in the missions list
    And Participant Pascal sees the milestone "build-endurance" as locked in the mission "physically-fit"

  Scenario: Participant Pascal makes progress within the first milestone
    When Participant Pascal completes the "daily-walk" task for the mission "physically-fit"
    Then Participant Pascal sees progress recorded for the milestone "move-more" in the mission "physically-fit"

  Scenario: Participant Pascal does not progress with an activity below the task requirement
    When Participant Pascal submits a walk below the "daily-walk" task requirement for the mission "physically-fit"
    Then Participant Pascal sees no task progress for the milestone "move-more" in the mission "physically-fit"
    And Participant Pascal sees the milestone "build-endurance" as locked in the mission "physically-fit"
