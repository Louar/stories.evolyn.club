@ui @story-module
Feature: Play World Food Expedition
  Readers complete map and sorting challenges using the imported taxonomy data.

  Scenario: Recover from a map mistake and complete all five expedition stages
    Given an editor has created a fresh "World Food Expedition" demo
    And I am an anonymous reader using English
    And I open the standalone "World Food Expedition" story
    When I choose an incorrect location in the first country round
    Then the expedition lets me correct the same round
    When I complete every round of these expedition stages:
      | stage                |
      | Locate countries     |
      | Compare populations  |
      | Trace food origins   |
      | Compare nutrition    |
      | Classify food groups |
    Then the standalone player reports successful completion and offers a restart
