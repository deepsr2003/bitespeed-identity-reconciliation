# Bitespeed Identity Reconciliation API

A Node.js/TypeScript API that identifies and links customer identities across multiple purchases using email and phone number reconciliation.

## Live Endpoint

**Base URL:** `https://bitespeed-identity-reconciliation-98po.onrender.com`

### POST /identify

**Request:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "123456"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** SQLite (via Prisma ORM)
- **Testing:** Jest

## Setup Instructions

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client and create database
npx prisma db push

# Build TypeScript
npm run build

# Start server
npm start

# Run tests
npm test
```

### Deployment to Render.com

1. Push code to GitHub
2. Go to [Render.com](https://render.com) and sign in
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: `Node`
6. Add Environment Variable:
   - `DATABASE_URL` = `file:/app/data/dev.db`
7. Enable "Disk" option (for SQLite persistence)
8. Click "Create Web Service"

## API Documentation

### Identify Endpoint

Links customer identities based on email or phone number.

**Request Body:**
```json
{
  "email": "string|null",
  "phoneNumber": "string|null"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": number,
    "emails": string[],
    "phoneNumbers": string[],
    "secondaryContactIds": number[]
  }
}
```

## Features

- Creates primary contact for new customers
- Creates secondary contacts when partial match found (same email OR phone)
- Merges multiple primary contacts when linked by new information
- Returns consolidated contact with all emails/phones from linked contacts
- Handles null email and phoneNumber gracefully

## Testing

```bash
# Run unit tests
npm test
```

Test coverage:
- ✓ Create new primary contact when no matches exist
- ✓ Create secondary contact when partial match found
- ✓ Merge multiple primary contacts when linked
- ✓ Return same result for different queries within same contact group
- ✓ Handle both email and phone being null
