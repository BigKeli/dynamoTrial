# Session Tracking System - Architecture Guide


This project demonstrates DynamoDB, AWS Lambdas and AWS API Gateway knowledge. Being able to create a AWS stack infrastructure to be able to warm save and retrieve user data originating from Google Tab Manager regarding a specific websites product.

Live API: https://179kz5ayv7.execute-api.us-east-1.amazonaws.com/dev


## 🏗️ Entity Model



### **Session**
A user's journey on your site/app.

```javascript
{
  sessionId: "sess_abc123",        // Unique identifier
  externalId: "user@example.com",  // User identifier (optional)
  status: "active",                 // active | completed
  stepsTaken: 5,                    // Auto-incremented with each event
  userAgent: "Mozilla/5.0...",
  ipAddress: "203.0.113.1",
  createdAt: "2026-01-27T10:00:00Z",
  updatedAt: "2026-01-27T10:05:00Z",
  metadata: {                       // Custom data
    source: "google",
    campaign: "summer_sale"
  }
}
```

### **Event**
An action within a session.

```javascript
{
  eventId: "evt_xyz789",
  sessionId: "sess_abc123",        // Links to session
  eventType: "click",              // landing | click | quiz_start | etc.
  eventData: {                      // Custom event data
    page: "/product",
    button: "buy_now",
    product_id: "12345"
  },
  timestamp: "2026-01-27T10:03:00Z",
  userAgent: "Mozilla/5.0...",
  ipAddress: "203.0.113.1"
}
```

---

## 🔗 Entity Relationships

```
┌─────────────────────────────────────────────────┐
│                    USER                         │
│             (externalId)                        │
│                                                 │
│  user@example.com                              │
└────────────┬────────────────────────────────────┘
             │
             │ has many
             ├─────────────┬─────────────┬────────
             ▼             ▼             ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   SESSION    │ │   SESSION    │ │   SESSION    │
    │              │ │              │ │              │
    │  sess_001    │ │  sess_002    │ │  sess_003    │
    │  5 steps     │ │  3 steps     │ │  10 steps    │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           │ has many       │ has many       │ has many
           ├──────┬─────    └──────          └──────
           ▼      ▼
    ┌─────────┐ ┌─────────┐
    │  EVENT  │ │  EVENT  │
    │         │ │         │
    │ landing │ │ click   │
    │ 10:00   │ │ 10:03   │
    └─────────┘ └─────────┘
```

---

## 📊 DynamoDB Table Design (Single-Table)

```
┌─────────────────────────────────────────────────────────────────┐
│                     session-tracking                            │
├──────────────────────┬──────────────────────┬──────────────────┤
│         PK           │         SK           │     itemType      │
├──────────────────────┼──────────────────────┼──────────────────┤
│ SESSION#sess_abc123  │ #METADATA            │ SESSION_METADATA  │  ← Session
│ SESSION#sess_abc123  │ EVENT#2026...#evt1   │ EVENT            │  ← Event 1
│ SESSION#sess_abc123  │ EVENT#2026...#evt2   │ EVENT            │  ← Event 2
│ SESSION#sess_abc123  │ EVENT#2026...#evt3   │ EVENT            │  ← Event 3
│ SESSION#sess_xyz789  │ #METADATA            │ SESSION_METADATA  │  ← Session
│ SESSION#sess_xyz789  │ EVENT#2026...#evt4   │ EVENT            │  ← Event 4
└──────────────────────┴──────────────────────┴──────────────────┘

GSI1 (User Lookup Index):
┌──────────────────────┬──────────────────────┐
│       GSI1PK         │       GSI1SK         │
├──────────────────────┼──────────────────────┤
│ USER#user@email.com  │ SESSION#2026-01-27   │  ← Find all user sessions
│ USER#user@email.com  │ SESSION#2026-01-28   │
└──────────────────────┴──────────────────────┘
```


## 💡 Sample Use Case

### **E-commerce Journey Tracking**

```javascript
// 1. User lands on site
POST /sessions
{
  "sessionId": "sess_001",
  "externalId": "shopper@email.com",
  "metadata": {"source": "google_ads"}
}

// 2. Views homepage
POST /events
{
  "sessionId": "sess_001",
  "eventType": "landing",
  "eventData": {"page": "/"}
}

// 3. Clicks product
POST /events
{
  "sessionId": "sess_001",
  "eventType": "click",
  "eventData": {"page": "/products", "product_id": "12345"}
}

// 4. Starts quiz
POST /events
{
  "sessionId": "sess_001",
  "eventType": "quiz_start",
  "eventData": {"quiz_name": "find_your_style"}
}

// 5. Completes quiz
POST /events
{
  "sessionId": "sess_001",
  "eventType": "quiz_complete",
  "eventData": {"result": "modern_minimalist"}
}

// 6. Begins checkout
POST /events
{
  "sessionId": "sess_001",
  "eventType": "checkout_start",
  "eventData": {"cart_value": 149.99}
}

// 7. Completes purchase
POST /events
{
  "sessionId": "sess_001",
  "eventType": "checkout_complete",
  "eventData": {"order_id": "ORD-789", "value": 149.99}
}

// 8. Mark session complete
PATCH /sessions/sess_001
{
  "status": "completed"
}

// 9. Get full journey
GET /sessions/sess_001
// Returns: session + all 6 events in chronological order

// 10. Get analytics
GET /sessions/sess_001/metadata
// Returns: conversion funnel, event breakdown, duration
```

### **Result:**
```javascript
{
  "session": {
    "sessionId": "sess_001",
    "externalId": "shopper@email.com",
    "status": "completed",
    "stepsTaken": 6,
    "duration": 420  // seconds
  },
  "events": [...],  // 6 events chronologically
  "analytics": {
    "eventBreakdown": {
      "landing": 1,
      "click": 1,
      "quiz_start": 1,
      "quiz_complete": 1,
      "checkout_start": 1,
      "checkout_complete": 1
    },
    "conversionFunnel": {
      "landed": true,
      "engaged": true,
      "startedCheckout": true,
      "converted": true  // 🎉 Purchase!
    }
  }
}
```

---



---

## 🎯 Key Concepts

1. **Session = Container** for a user's journey
2. **Event = Action** within that journey
3. **stepsTaken** auto-increments with each event
4. **Single Table** stores both entities efficiently
5. **GSI** enables fast user lookups
6. **Timestamps in SK** auto-sort events chronologically

---

## 🚀 Quick Commands

```bash
# Test everything
./run-tests.sh

# Add sample data
./seed-test-data.sh

# Check data integrity
cd src/scripts && npm run audit
```

---

