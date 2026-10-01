@api @story-module
Feature: Publish independent demo collections
  Editors create isolated demo content and control anonymous availability.

  Scenario: Create independent collections with intact story and taxonomy dependencies
    Given an editor is authenticated for story authoring
    When the editor creates two copies of "Discovery Collection"
    Then both copies contain the expected three stories in order
    And each copy keeps the anthology description and thumbnail
    And each copy resolves its taxonomy references to its own imported taxonomies
    And the copies have different anthology, story, and taxonomy identities
    When the editor unpublishes "Trail Decisions" in the first copy
    Then an anonymous reader cannot open that story or its anthology
    And an anonymous reader can still open the second anthology and its "Trail Decisions" story
    When the editor republishes "Trail Decisions" in the first copy
    Then an anonymous reader can open the first anthology and its "Trail Decisions" story

  Scenario Outline: Non-public content cannot be opened through a shared link
    Given an editor has created a fresh "Discovery Collection" demo
    When the editor makes the <resource> private
    Then an anonymous reader receives not found for the <resource> shared link

    Examples:
      | resource  |
      | story     |
      | anthology |
