@ui @story-module
Feature: Play illustrated imported food maps
  Readers identify farm origins, animals, and meat cuts using detailed educational illustrations.

  Scenario Outline: Complete the farm-origin game on an illustrated landscape
    Given an editor has imported and published a fresh "farm-to-table-pin-game" source bundle with its taxonomy
    And I am an anonymous reader using English
    And I use the food map on a "<viewport>" screen
    And I open the standalone "Farm to fork: pin the ingredient" story
    When I reach the farm-origin game
    Then the landscape shows these eight labelled and individually selectable illustrated farms:
      | farm             | illustration                         |
      | Fruit orchard    | fruit trees and orchard rows         |
      | Sugar beet farm  | leafy beet rows and harvested roots  |
      | Poultry farm     | chickens and a poultry house         |
      | Dairy farm       | dairy cattle and milking facilities  |
      | Beef cattle farm | beef cattle in a fenced pasture      |
      | Arable farm      | grain and potato fields              |
      | Vegetable farm   | vegetable beds and a greenhouse      |
      | Pig farm         | pigs and a pig shelter               |
    When I complete all 12 farm-origin rounds using the imported ingredient answers
    Then illustrated map selections show correct feedback without artwork blocking pointer or keyboard input
    And the standalone player reports successful completion and offers a restart

    Examples:
      | viewport |
      | desktop  |
      | mobile   |

  Scenario Outline: Complete animal identification and the advanced butcher chart
    Given an editor has imported and published a fresh "meat-cuts-and-animals" source bundle with its taxonomy
    And I am an anonymous reader using English
    And I use the food map on a "<viewport>" screen
    And I open the standalone "Match the meat: butcher chart" story
    When I reach the animal-identification game
    Then the animal scene shows these labelled and individually selectable detailed animals:
      | animal      | illustration                            |
      | Beef cattle | full body, muzzle, ears, hooves and tail |
      | Chicken     | full body, beak, comb, wing and feet      |
      | Pig         | full body, snout, ears, trotters and tail |
      | Lamb        | full body, wool, ears, hooves and tail    |
    When I complete all 10 animal-identification rounds using the imported meat answers
    Then the advanced butcher chart opens without a "No playable rounds" error
    And the chart is identified as an educational schematic rather than a precise butchery guide
    And all 44 imported cut regions are individually selectable within the corresponding animal silhouettes
    And the cut boundaries follow plausible body regions with no visible cut-name answer labels
    When I zoom and pan the butcher chart
    Then the illustrations, cut boundaries and selection targets remain aligned
    When I complete all 10 butcher-chart rounds using the imported meat answers
    Then illustrated map selections show correct feedback without artwork blocking pointer or keyboard input
    And the standalone player reports successful completion and offers a restart

    Examples:
      | viewport |
      | desktop  |
      | mobile   |
