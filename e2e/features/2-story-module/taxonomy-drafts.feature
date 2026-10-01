@api @story-module
Feature: Taxonomy drafts
  Editors configure taxonomy drafts that become playable question rounds.

  Scenario: A draft does not repeat the same item and attribute question
    Given an editor has created a fresh "World Food Expedition" demo
    When the editor requests a taxonomy draft with three rounds from one item and one attribute
    Then the taxonomy draft returns one unique item-attribute question
