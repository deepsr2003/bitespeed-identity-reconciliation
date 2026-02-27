# Bitespeed Identity Reconciliation - Specification

## Project Overview
- **Project name:** Bitespeed Identity Reconciliation Service
- **Type:** REST API Web Service
- **Core functionality:** Link customer identities across multiple purchases using email/phone number reconciliation
- **Target users:** E-commerce platforms like FluxKart.com

## Technology Stack
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** SQLite with better-sqlite3
- **ORM:** Prisma (for easier database operations)

## Database Schema

### Contact Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | Int | Primary Key, Auto-increment |
| phoneNumber | String? | Nullable |
| email | String? | Nullable |
| linkedId | Int? | Foreign Key to Contact.id, Nullable |
| linkPrecedence | String | "primary" or "secondary" |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-generated |
| deletedAt | DateTime? | Nullable |

## API Specification

### POST /identify

**Request Body:**
```json
{
  "email": "string|null",
  "phoneNumber": "string|null"
}
```

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["email1@domain.com", "email2@domain.com"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Identity Reconciliation Logic

### Scenario 1: New Contact (No existing matches)
- Create new primary Contact with provided email/phoneNumber
- Return the new contact

### Scenario 2: Exact Match Found
- If incoming request matches exactly one existing contact, return that contact's consolidated info

### Scenario 3: Partial Match (common email OR phone)
- Find all contacts that share email OR phoneNumber with incoming request
- If multiple primary contacts found, merge them:
  - Keep the oldest primary as the main primary
  - Convert other primaries to secondary and link to the main primary
  - Update all their linkedId to point to the main primary
- Create a new secondary contact with the new information
- Return consolidated contact info

### Scenario 4: Chain of Contacts
- Find all linked contacts (primary + all secondaries)
- Return all their emails and phoneNumbers consolidated

## Acceptance Criteria

1. POST /identify returns correct consolidated contact information
2. New contacts are created when no matches exist
3. Secondary contacts are created when partial matches are found
4. Multiple primary contacts are merged when linked by new information
5. All related contacts (via linkPrecedence chain) are returned
6. Response format matches specification exactly
7. Code compiles without TypeScript errors
8. Basic unit tests pass
