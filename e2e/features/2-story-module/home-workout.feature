@ui @story-module @external-media
Feature: Play Home Workout
  Readers can replay an exercise and finish the workout.

  Scenario: Replay an exercise after an incorrect answer and finish the workout
    Given an editor has created a fresh "Home Workout" demo
    And I am an anonymous reader using English
    And I open the standalone "Home Workout" story
    When I choose an unsafe pace after the first exercise
    Then the exercise replays and its question returns
    When I choose a comfortable pace and steady controlled movements
    And I finish the stretching exercise
    Then the standalone player reports successful completion and offers a restart
