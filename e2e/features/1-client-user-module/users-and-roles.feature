@api @client-user-module
Feature: Manage user accounts and global roles
  Account changes affect only authorized users in the current client.

  Background:
    Given the named users are available

  Scenario Outline: An authorized user creates an account with an explicit global role
    Given <creator> is authenticated through the API
    And <new user> has not yet been created in the current client
    When <creator> creates <new user> with their scenario email, password, and exactly the global role "<role>"
    Then the user creation response has status 201
    And the created account belongs to the current client and has <new user>'s exact scenario email and global role "<role>"
    When <new user> signs in through the API with their correct password
    Then the sign-in response has status 201 and identifies <new user>
    And <new user> can read their own profile with their exact user ID, current client ID, and global role "<role>"

    Examples:
      | creator      | new user          | role        |
      | Admin Alpha  | Editor Alpha      | editor      |
      | Editor Alpha | Participant Alpha | participant |

  Scenario: A participant updates their own profile
    Given Participant Alpha is authenticated through the API
    And Participant Alpha has the following profile:
      | firstName | Participant |
      | lastName  | Alpha       |
      | language  | en          |
    When Participant Alpha updates their own profile with:
      | firstName | Alpha  |
      | lastName  | Walker |
      | language  | nl     |
    Then the user update response has status 200
    And Participant Alpha reads the following persisted profile:
      | firstName | Alpha  |
      | lastName  | Walker |
      | language  | nl     |
    And Participant Alpha's user ID, client ID, email, and global roles are unchanged

  Scenario: A participant deletes their own account
    Given Participant Alpha is authenticated through the API
    And Admin Alpha is authenticated through the API
    When Participant Alpha deletes their own account
    Then the user deletion response has status 204
    And Admin Alpha receives status 404 when reading Participant Alpha's deleted account
    When Participant Alpha signs in through the API with their former password
    Then the sign-in response has status 422
    And the sign-in response supplies no token or usable session cookie

  Scenario: An editor cannot create a second account with the same client email
    Given Editor Alpha is authenticated through the API
    And Participant Alpha is active with exactly the global role "participant"
    And Participant Bravo has not yet been created in the current client
    When Editor Alpha attempts to create Participant Bravo with Participant Alpha's email and exactly the global role "participant"
    Then the user creation response has status 422 with an error for "email"
    And exactly one account in the current client has Participant Alpha's email
    And that account is still Participant Alpha with unchanged profile and global roles
    And no account has been created for Participant Bravo

  Scenario Outline: A participant cannot modify another participant's account
    Given Participant Alpha is authenticated through the API
    And Participant Bravo is active with exactly the global role "participant"
    When Participant Alpha attempts to <operation> Participant Bravo's account
    Then the user mutation response has status 403
    And Participant Bravo's account still exists with unchanged profile, password, active status, and global roles

    Examples:
      | operation                |
      | change the first name of |
      | delete                   |
