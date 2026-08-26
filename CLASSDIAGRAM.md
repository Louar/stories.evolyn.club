# STORIES

## Class diagram

```mermaid
classDiagram
  class Translatable {
      <<interface>>
      default: string?
      en: string?
      de: string?
      es: string?
      fr: string?
      it: string?
      nl: string?
      pt: string?
  }

  class MediaCollection {
      <<enumeration>>
      EXTERNALS
      INTERNALS
      CLIENTS
      USERS
  }

  class Media {
      <<interface>>
      collection: MediaCollection
      filename: string
  }

  %% CLIENT-USER MODULE

  class ClientAuthenticationMethod {
      <<enumeration>>
      PASSWORD
      CODE
  }

  class UserRole {
      <<enumeration>>
      PARTICIPANT
      EDITOR
      ADMIN
  }

  class Client {
      slug: string*
      name: string
      description: jsonb?
      domains: string[]
      administrationEmail: string?
      favicon: Media?
      logo: Media?
      splash: Media?
      hero: Media?
      css: jsonb?
      manifest: jsonb?
      isFindableBySearchEngines: boolean
      plausibleDomain: string?
      authenticationMethods: ClientAuthenticationMethod[]
      accessTokenKey: string
      redirectAuthorized: string?
      redirectUnauthorized: string?
      createdAt: datetime
      updatedAt: datetime
  }

  class ClientApiKey {
      name: string
      secret: string
      scopes: string[]
      lastUsedAt: datetime
      createdAt: datetime
      updatedAt: datetime
  }

  class User {
      email: string?
      emailConfirmed: boolean
      emailConfirmCode: string?
      firstName: string?
      lastName: string?
      roles: UserRole[]
      language: string?
      pronouns: string?
      address: jsonb?
      dateOfBirth: date?
      password: string?
      passwordResetCode: string?
      passwordResetExpiresAt: datetime?
      phone: string?
      phoneConfirmed: boolean
      isActive: boolean
      reasonForDeactivation: string?
      createdAt: datetime
      updatedAt: datetime
  }

  class AuthCode {
      value: string
      usedAt: datetime?
  }

  class License {
      name: Translatable
      version: string
      termsOfUse: Translatable?
      privacyPolicy: Translatable?
      createdAt: datetime
      updatedAt: datetime
  }

  class LicenseAgreement {
      isAccepted: boolean
      createdAt: datetime
      updatedAt: datetime
  }

  class ClientMedia {
      name: string
      extension: string
      description: string?
      size: integer
      createdAt: datetime
      updatedAt: datetime
  }

  class UserMedia {
      name: string
      extension: string
      description: string?
      size: integer
      createdAt: datetime
      updatedAt: datetime
  }

  Client "1" -- "*" ClientApiKey
  Client "1" -- "*" User
  Client "1" -- "*" AuthCode
  User "1" -- "*" AuthCode
  Client "1" -- "*" License
  Client "1" -- "*" ClientMedia
  User "1" -- "*" UserMedia
  User "1" -- "*" LicenseAgreement
  License "1" -- "*" LicenseAgreement

  Client "*" -- "0..1" User: createdBy
  Client "*" -- "0..1" User: updatedBy
  ClientApiKey "*" -- "0..1" User: createdBy
  ClientApiKey "*" -- "0..1" User: updatedBy
  License "*" -- "0..1" User: createdBy
  License "*" -- "0..1" User: updatedBy
  ClientMedia "*" -- "0..1" User: createdBy
  ClientMedia "*" -- "0..1" User: updatedBy
  UserMedia "*" -- "0..1" User: createdBy
  UserMedia "*" -- "0..1" User: updatedBy

  %% STORY MODULE

  class LogicHitpolicy {
      <<enumeration>>
      FIRST
  }

  class PermissionRole {
      <<enumeration>>
      VIEWER
      EDITOR
      OWNER
  }

  class PartBackgroundType {
      <<enumeration>>
      VIDEO
  }

  class PartForegroundType {
      <<enumeration>>
      ANNOUNCEMENT
      QUIZ
  }

  class Anthology {
      id: string
      clientId: string
      reference: string
      name: Translatable
      configuration: jsonb?
      isPublished: boolean
      isPublic: boolean
      createdAt: datetime
      createdBy: string?
      updatedAt: datetime
      updatedBy: string?
  }

  class AnthologyPermission {
      id: string
      userId: string
      anthologyId: string
      role: PermissionRole
      createdAt: datetime
      createdBy: string?
      updatedAt: datetime
      updatedBy: string?
  }

  class AnthologyPosition {
      id: string
      anthologyId: string
      storyId: string
      order: number
      configuration: jsonb?
  }

  class Story {
      id: string
      clientId: string
      reference: string
      name: Translatable
      configuration: jsonb?
      isPublished: boolean
      isPublic: boolean
      createdAt: datetime
      createdBy: string?
      updatedAt: datetime
      updatedBy: string?
  }

  class StoryPermission {
      id: string
      userId: string
      storyId: string
      role: PermissionRole
      createdAt: datetime
      createdBy: string?
      updatedAt: datetime
      updatedBy: string?
  }

  class StoryAuthCode {
      id: string
      storyId: string
      value: string
      usedAt: datetime?
  }

  class Part {
      id: string
      storyId: string
      backgroundType: string?
      backgroundConfiguration: jsonb?
      foregroundType: string?
      foregroundConfiguration: jsonb?
      isInitial: boolean
      defaultNextPartId: string?
      videoId: string?
      announcementTemplateId: string?
      quizLogicForPartId: string?
      position: jsonb?
  }

  class Video {
      id: string
      name: string
      source: Media
      thumbnail: Media?
      captions: Translatable?
      duration: number
  }

  class VideoAvailableToStory {
      id: string
      storyId: string
      videoId: string
  }

  class AnnouncementTemplate {
      id: string
      name: string
      title: Translatable?
      message: Translatable?
  }

  class AnnouncementTemplateAvailableToStory {
      id: string
      storyId: string
      announcementTemplateId: string
  }

  class QuizTemplate {
      id: string
      name: string
      doRandomize: boolean
  }

  class QuizTemplateAvailableToStory {
      id: string
      storyId: string
      quizTemplateId: string
  }

  class QuizQuestionTemplateAnswerGroup {
      id: string
      reference: string?
      name: string?
      doRandomize: boolean
      isGlobal: boolean
  }

  class QuizQuestionTemplateAnswerItem {
      id: string
      quizQuestionTemplateAnswerGroupId: string
      order: number
      value: string
      label: Translatable
  }

  class QuizQuestionTemplate {
      id: string
      quizTemplateId: string
      order: number
      answerTemplateReference: string
      title: Translatable
      instruction: Translatable?
      placeholder: Translatable?
      configuration: jsonb?
      isRequired: boolean
      quizQuestionTemplateAnswerGroupId: string?
  }

  class QuizLogicForPart {
      id: string
      quizTemplateId: string
      defaultNextPartId: string?
      hitpolicy: LogicHitpolicy
  }

  class QuizLogicRule {
      id: string
      order: number
      name: string
      quizLogicForPartId: string
      nextPartId: string?
  }

  class QuizLogicRuleInput {
      id: string
      quizLogicRuleId: string
      quizQuestionTemplateId: string
      quizQuestionTemplateAnswerItemId: string?
      value: jsonb?
  }

  class EventTransition {
      id: string
      url: string
      session: string
      createdAt: datetime
      fromPartId: string
      toPartId: string
  }

  class EventInteraction {
      id: string
      url: string
      session: string
      createdAt: datetime
      partId: string
      quizQuestionTemplateId: string
      quizQuestionTemplateAnswerItemId: string?
      value: jsonb?
  }

  Client "1" -- "*" Anthology
  Client "1" -- "*" Story

  Anthology "1" -- "*" AnthologyPermission
  Anthology "1" -- "*" AnthologyPosition

  Story "1" -- "*" AnthologyPosition

  User "1" -- "*" AnthologyPermission: user

  Anthology "*" -- "0..1" User: createdBy
  Anthology "*" -- "0..1" User: updatedBy

  AnthologyPermission "*" -- "0..1" User: createdBy
  AnthologyPermission "*" -- "0..1" User: updatedBy

  Story "1" -- "*" StoryPermission
  Story "1" -- "*" StoryAuthCode
  Story "1" -- "*" Part

  User "1" -- "*" StoryPermission: user

  Story "*" -- "0..1" User: createdBy
  Story "*" -- "0..1" User: updatedBy

  StoryPermission "*" -- "0..1" User: createdBy
  StoryPermission "*" -- "0..1" User: updatedBy

  Part "*" -- "0..1" Part: defaultNextPart
  Part "*" -- "0..1" Video: video
  Part "*" -- "0..1" AnnouncementTemplate: announcementTemplate
  Part "*" -- "0..1" QuizLogicForPart: quizLogic

  Story "1" -- "*" VideoAvailableToStory
  Video "1" -- "*" VideoAvailableToStory

  Story "1" -- "*" AnnouncementTemplateAvailableToStory
  AnnouncementTemplate "1" -- "*" AnnouncementTemplateAvailableToStory

  Story "1" -- "*" QuizTemplateAvailableToStory
  QuizTemplate "1" -- "*" QuizTemplateAvailableToStory

  QuizTemplate "1" -- "*" QuizQuestionTemplate

  QuizQuestionTemplateAnswerGroup "1" -- "*" QuizQuestionTemplateAnswerItem
  QuizQuestionTemplate "*" -- "0..1" QuizQuestionTemplateAnswerGroup: answerGroup

  QuizTemplate "1" -- "*" QuizLogicForPart

  QuizLogicForPart "1" -- "*" QuizLogicRule
  QuizLogicForPart "*" -- "0..1" Part: defaultNextPart

  QuizLogicRule "1" -- "*" QuizLogicRuleInput
  QuizLogicRule "*" -- "0..1" Part: nextPart

  QuizLogicRuleInput "*" -- "1" QuizQuestionTemplate: question
  QuizLogicRuleInput "*" -- "0..1" QuizQuestionTemplateAnswerItem: answer

  EventTransition "*" -- "1" Part: fromPart
  EventTransition "*" -- "1" Part: toPart

  EventInteraction "*" -- "1" Part: part
  EventInteraction "*" -- "1" QuizQuestionTemplate: question
  EventInteraction "*" -- "0..1" QuizQuestionTemplateAnswerItem: answer

```
