@ui @story-module
Feature: Play Trail Decisions
  Readers can recover from a poor decision or restart an unsuccessful attempt.

  Background:
    Given an editor has created a fresh "Trail Decisions" demo
    And I am an anonymous reader using English

  Scenario: Rewind a poor decision and complete the standalone story
    Given I open the standalone "Trail Decisions" story
    When I choose the ridge and rewind to the junction
    And I guide Rowan to rescue using the service road, emergency call, and whistle
    Then the story confirms Rowan was rescued
    And the standalone player reports successful completion and offers a restart

  Scenario: Restart after an unsuccessful attempt
    Given I open the standalone "Trail Decisions" story
    When I choose the ridge and end the attempt without rewinding
    Then the story confirms the connection closed without a rescue
    And the standalone player reports unsuccessful completion and offers a restart
    When I restart the story
    Then I can make a fresh choice at the original junction
