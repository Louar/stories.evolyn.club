@ui @story-module @external-media
Feature: Play Quiz of Cities
  Readers can correct a city answer and complete the video quiz.

  Scenario: Correct a city answer and complete the video quiz
    Given an editor has created a fresh "Quiz of Cities" demo
    And I am an anonymous reader using English
    And I open the standalone "Quiz of Cities" story
    When I confirm both readiness questions
    And I incorrectly identify Barcelona as Amsterdam
    Then the video quiz lets me retry the Barcelona question
    When I correctly identify Barcelona and Luzern
    Then the standalone player reports successful completion and offers a restart
