@api @client-user-module
Feature: Authenticate named users
  Users authenticate with isolated sessions and retain their assigned global role.

  Background:
    Given the named users are available

  Scenario Outline: An active user signs in with their assigned global role
    Given <user> is active with exactly the global role "<role>"
    And <user> has no authenticated session
    When <user> signs in through the API with their correct password
    Then the sign-in response has status 201 and identifies <user>
    And the sign-in response supplies a token and an HTTP-only session cookie for the current host
    And <user> can read their own profile with their exact user ID, current client ID, and global role "<role>"

    Examples:
      | user              | role        |
      | Admin Alpha       | admin       |
      | Editor Alpha      | editor      |
      | Participant Alpha | participant |

  Scenario: An incorrect password does not authenticate the user
    Given Participant Alpha is active with exactly the global role "participant"
    And Participant Alpha has no authenticated session
    When Participant Alpha signs in through the API with an incorrect password
    Then the sign-in response has status 422
    And the sign-in response supplies no token or usable session cookie
    And Participant Alpha's password, active status, and global roles are unchanged

  Scenario: A deactivated user cannot start a password session
    Given Participant Alpha is inactive with exactly the global role "participant"
    And Participant Alpha has no authenticated session
    When Participant Alpha signs in through the API with their correct password
    Then the sign-in response has status 422
    And the sign-in response supplies no token or usable session cookie
    And Participant Alpha remains inactive with exactly the global role "participant"
