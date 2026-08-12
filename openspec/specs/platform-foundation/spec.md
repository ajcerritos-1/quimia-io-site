# Platform Foundation Specification

## Purpose

Cross-cutting conventions established in Story 1.1 for reuse by every later epic: typed environment config, structured JSON logging, and a single API error envelope.

Traces to: BMad Story 1.1 Task 1 & 6; ARCHITECTURE-SPINE.md `Consistency Conventions`, `Stack` (P1010 guard).

## Requirements

### Requirement: Typed Environment Configuration

The system MUST validate all environment variables through a Zod schema in `src/shared/config/`. Raw `process.env` reads MUST NOT occur in business logic. Environment variables MUST be loaded before any Prisma client is instantiated.

#### Scenario: Environment validated via Zod before app logic runs

- GIVEN the app starts
- WHEN environment variables are read
- THEN they are validated through the Zod schema in `src/shared/config/`
- AND no raw `process.env` read occurs in business logic

#### Scenario: Env loaded before Prisma client instantiation (P1010 guard)

- GIVEN Prisma 7 no longer auto-loads env vars
- WHEN the app boots
- THEN env vars are explicitly loaded before any Prisma client is instantiated anywhere in the app
- AND this prevents the P1010 "denied access" runtime error

### Requirement: Structured JSON Logging With Tenant and Request Context

Every log line MUST be structured JSON and MUST carry `tenant_id` and `request_id`.

#### Scenario: Every log line carries tenant and request context

- GIVEN any request is processed
- WHEN a log line is emitted
- THEN it is structured JSON containing `tenant_id` and `request_id` fields

### Requirement: Single API Error Envelope

Every API error response MUST use the single envelope shape `{ error: { code, message, details? } }`.

#### Scenario: API errors return the single envelope shape

- GIVEN an API request fails
- WHEN the error response is returned
- THEN its body matches `{ error: { code, message, details? } }`
