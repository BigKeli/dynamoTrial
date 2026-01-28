# Quick Start Guide

## What You Built

A **session-centric event tracking API** for marketing analytics.

**Live API:** `https://179kz5ayv7.execute-api.us-east-1.amazonaws.com/dev`

---

## Core Entities

### 1. **Session** - A user's visit
- Unique identifier: `sessionId`
- Linked to user: `externalId` (email, user ID, etc.)
- Tracks: status, steps taken, duration, metadata
- Contains: multiple events in chronological order

### 2. **Event** - Actions within a session
- Types: `landing`, `click`, `form_submit`, `product_view`, `checkout_complete`, etc.
- Auto-timestamped and ordered
- Increments session's `stepsTaken` counter
- Stores custom data in `eventData` field

**How they work together:**
```
User (externalId) → Session → Events (timeline)
                    ↓
             Analytics & Funnels
```

---

## Test Everything (30 seconds)

```bash
./run-tests.sh    # Tests all 11 endpoints + infrastructure
```

---

## Essential Commands

### Create Session → Track Events → View Analytics

```bash
# 1. Create a session
curl -X POST $API/sessions -H "Content-Type: application/json" -d '{
  "sessionId": "sess_demo",
  "externalId": "user@example.com"
}'

# 2. Track events
curl -X POST $API/events -H "Content-Type: application/json" -d '{
  "sessionId": "sess_demo",
  "eventType": "landing",
  "eventData": {"page": "/homepage"}
}'

# 3. View session timeline (with all events)
curl $API/sessions/sess_demo

# 4. Get analytics (funnel, duration, event breakdown)
curl $API/sessions/sess_demo/metadata

# 5. Get all sessions for a user
curl $API/users/user@example.com/sessions
```

---

## Rebuild & Deploy

```bash
cd infrastructure
rm -rf .aws-sam/build    # Clean build
make build               # Package Lambda
make deploy              # Update AWS
```

---

## Utilities

```bash
# View Lambda logs
cd infrastructure && make logs

# Audit data integrity
cd src/scripts && npm run audit

# Add demo data
cd src/scripts && npm run seed
```

---

## Valid Event Types

`landing` | `click` | `form_submit` | `form_start` | `product_view` | `add_to_cart` | `checkout_start` | `checkout_complete` | `quiz_start` | `quiz_complete` | `page_view` | `video_play` | `signup` | `login` | `custom`

---

## What's Deployed

- ✅ **11 REST Endpoints** (6 session + 5 event)
- ✅ **DynamoDB Table** (single-table design with GSI)
- ✅ **Lambda Function** (Node.js 20, ARM64)
- ✅ **Auto-scaling** (serverless, handles any load)
- ✅ **Cost:** ~$0-5/month (free tier eligible)

**Run `./run-tests.sh` to verify!** 🚀
