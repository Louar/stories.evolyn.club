@ui @story-module
Feature: Discover and play stories in an anthology
  Readers can explore a collection and retain their completed stories.

  Background:
    Given an editor has created a fresh "Discovery Collection" demo
    And I am an anonymous reader using English

  Scenario: Complete a grid story and retain completion after reloading
    Given I open the anthology grid
    Then the collection offers these stories in order:
      | story                 |
      | Quiz of Cities        |
      | Trail Decisions       |
      | World Food Expedition |
    When I open "Trail Decisions" from the grid
    And I guide Rowan to rescue using the service road, emergency call, and whistle
    Then I return to the collection with "Trail Decisions" marked completed
    When I reload the collection
    Then "Trail Decisions" is still marked completed
    And the other stories are not marked completed

  Scenario: Return from a story without completing it
    Given I open the anthology grid
    When I open "Trail Decisions" from the grid
    And I navigate back to the collection before finishing
    Then the collection is visible without any completed stories
    When I open "Trail Decisions" from the grid again
    Then I can make a fresh choice at the original junction

  Scenario: Browse a feed without earning completion
    Given the editor has configured the anthology as a feed
    When I browse all three stories to the performance overview
    Then the overview lists all three stories without successful completions
    When I navigate back to "Trail Decisions"
    Then I can make a fresh choice at the original junction
