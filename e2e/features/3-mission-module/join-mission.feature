@smoke @mission-module
Feature: Join a mission

  Scenario: Participant Pascal joins a mission through the API
    Given Participant Pascal is authenticated through the API
    And Participant Pascal is not enrolled in any mission
    When Participant Pascal joins the group "campaign-group"
    Then Participant Pascal sees the mission "physically-fit" in the missions list
