# Auth Sign-In Specification

## Purpose

Credential sign-in for lab staff (`admin` / `recepcionista` / `quimico`) via Better Auth, establishing a tenant-scoped session, with generic failure messaging and multi-tenant email/nickname uniqueness.

Traces to: BMad Story 1.1 ACs 1, 2, 4 (`1-1-user-sign-in.md`); AD-3, AD-8 (`ARCHITECTURE-SPINE.md`).

## Requirements

### Requirement: Credential Sign-In Establishes a Tenant-Scoped Session

The system MUST authenticate a valid nickname/email + password for an active user via Better Auth and establish a session scoped to the resolved `tenantId`.

#### Scenario: Successful sign-in with valid credentials

- GIVEN the subdomain `{lab}.quimiaio.com` has resolved a `tenantId` via bootstrap mode
- AND an active `User` exists matching `(tenantId, email-or-nickname)` with the correct password
- WHEN the user submits the sign-in form
- THEN Better Auth authenticates the user and a session scoped to that `tenantId` is established
- AND every subsequent request runs in scoped mode (`SET LOCAL app.tenant_id`/`app.role`)

#### Scenario: Tenant resolution precedes session existence (bootstrap mode)

- GIVEN sign-in starts and no session yet exists
- WHEN the subdomain is parsed
- THEN `tenantId` is resolved via a bootstrap-mode lookup against an RLS-exempt, narrowly-scoped tenant-resolution table/view
- AND a scoped transaction opens immediately after for everything that follows

### Requirement: Generic Authentication Failure Message

The system MUST return an identical, generic authentication-failed message for invalid credentials and inactive accounts, with no field-specific or account-state hint.

#### Scenario: Invalid password

- GIVEN a `User` exists with a valid email/nickname but the submitted password is wrong
- WHEN sign-in is submitted
- THEN the response is the generic authentication-failed message, with no indication of which field was wrong

#### Scenario: Inactive account with valid credentials

- GIVEN a `User` account is inactive
- WHEN valid credentials for that account are submitted
- THEN the response is byte-for-byte the same generic message as the invalid-password case

### Requirement: Multi-Tenant Email and Nickname Uniqueness

The system MUST enforce `User` uniqueness on the composite keys `(tenantId, email)` and `(tenantId, nickname)`, overriding Better Auth's default globally-unique-`email` assumption.

#### Scenario: Same email succeeds across two different tenants

- GIVEN Tenant A already has a `User` with email `x@y.com`
- WHEN Tenant B provisions a `User` with the same email `x@y.com`
- THEN Tenant B's user is created successfully — uniqueness is scoped per tenant, not global

#### Scenario: Duplicate email within the same tenant is rejected

- GIVEN Tenant A already has a `User` with email `x@y.com`
- WHEN Tenant A attempts to provision another `User` with the same email
- THEN creation fails with a `(tenantId, email)` uniqueness violation

#### Scenario: Duplicate nickname within the same tenant is rejected

- GIVEN Tenant A already has a `User` with nickname `jperez`
- WHEN Tenant A attempts to provision another `User` with the same nickname
- THEN creation fails with a `(tenantId, nickname)` uniqueness violation
