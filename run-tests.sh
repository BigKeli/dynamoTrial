#!/bin/bash

# Comprehensive Test Suite for Session Tracking API
# Tests all endpoints matching actual implementation in routes.js
# ⚠️  NOTE: Template.yaml has mismatched event endpoint paths - see comments below

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration (auto-detected from AWS)
API_BASE="${API_BASE:-https://179kz5ayv7.execute-api.us-east-1.amazonaws.com/dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TABLE_NAME="${TABLE_NAME:-session-tracking}"
AWS_PROFILE="${AWS_PROFILE:-default}"

# Test data
TEST_SESSION_ID="sess_test_$(date +%s)"
TEST_USER="test_user_$(date +%s)@example.com"

echo -e "${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        SESSION TRACKING API - COMPREHENSIVE TEST          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  API Endpoint: ${CYAN}$API_BASE${NC}"
echo -e "  AWS Region:   ${CYAN}$AWS_REGION${NC}"
echo -e "  Table Name:   ${CYAN}$TABLE_NAME${NC}"
echo -e "  Test Session: ${CYAN}$TEST_SESSION_ID${NC}"
echo -e "  Test User:    ${CYAN}$TEST_USER${NC}"
echo ""

# Warning about endpoint mismatch
echo -e "${YELLOW}⚠️  IMPORTANT NOTE:${NC}"
echo -e "  Template.yaml defines event endpoints as:"
echo -e "    ${CYAN}/sessions/{sessionId}/events/{eventId}${NC}"
echo -e "  But routes.js implements them as:"
echo -e "    ${CYAN}/events/{sessionId}/{eventId}/{timestamp}${NC}"
echo -e "  ${YELLOW}This test suite matches the actual implementation in routes.js${NC}"
echo ""

# Counter for tests
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${YELLOW}▶ TEST $TOTAL_TESTS: $test_name${NC}"
  
  if eval "$test_command"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}  ✓ PASSED${NC}"
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}  ✗ FAILED${NC}"
  fi
  echo ""
  sleep 0.5
}

# Function to test API endpoint
test_api() {
  local method="$1"
  local path="$2"
  local data="$3"
  local expected="${4:-success.*true}"
  
  if [ "$method" = "POST" ] || [ "$method" = "PATCH" ]; then
    response=$(curl -s -X "$method" "$API_BASE$path" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -X DELETE "$API_BASE$path")
  else
    response=$(curl -s "$API_BASE$path")
  fi
  
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
  echo "$response" | grep -q "$expected"
}

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 1: SESSION MANAGEMENT ENDPOINTS${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Create Session - POST /sessions
run_test "Create Session (POST /sessions)" \
  "test_api POST /sessions '{
    \"sessionId\": \"$TEST_SESSION_ID\",
    \"externalId\": \"$TEST_USER\",
    \"metadata\": {
      \"source\": \"test_suite\",
      \"test_run\": \"$(date -Iseconds)\",
      \"version\": \"1.0\"
    }
  }'"

# Test 2: Get Session - GET /sessions/{sessionId}
run_test "Get Session Timeline (GET /sessions/{sessionId})" \
  "test_api GET /sessions/$TEST_SESSION_ID"

# Test 3: Get Session Metadata/Analytics - GET /sessions/{sessionId}/metadata
run_test "Get Session Analytics (GET /sessions/{sessionId}/metadata)" \
  "test_api GET /sessions/$TEST_SESSION_ID/metadata"

# Test 4: Update Session - PATCH /sessions/{sessionId}
run_test "Update Session (PATCH /sessions/{sessionId})" \
  "test_api PATCH /sessions/$TEST_SESSION_ID '{
    \"status\": \"active\",
    \"metadata\": {
      \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"test_updated\": true
    }
  }'"

# Test 5: Get User Sessions - GET /users/{externalId}/sessions
run_test "Get User Sessions (GET /users/{externalId}/sessions)" \
  "test_api GET /users/$TEST_USER/sessions"

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 2: EVENT TRACKING ENDPOINTS${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 6: Track Single Event - POST /events
echo -e "${YELLOW}▶ TEST 6: Track Landing Event (POST /events)${NC}"
response=$(curl -s -X POST "$API_BASE/events" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$TEST_SESSION_ID'",
    "eventType": "landing",
    "eventData": {
      "page": "/homepage",
      "referrer": "google",
      "utm_source": "test"
    }
  }')
echo "$response" | jq '.'
if echo "$response" | grep -q '"success".*true'; then
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "${GREEN}  ✓ PASSED${NC}"
  # Extract event details for later tests
  TEST_EVENT_ID=$(echo "$response" | jq -r '.data.event.eventId')
  TEST_EVENT_TIMESTAMP=$(echo "$response" | jq -r '.data.event.timestamp')
  echo -e "  ${CYAN}Saved: eventId=$TEST_EVENT_ID, timestamp=$TEST_EVENT_TIMESTAMP${NC}"
else
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
  echo -e "${RED}  ✗ FAILED${NC}"
fi
echo ""
sleep 0.5

# Test 7: Track Click Event
run_test "Track Click Event (POST /events)" \
  "test_api POST /events '{
    \"sessionId\": \"$TEST_SESSION_ID\",
    \"eventType\": \"click\",
    \"eventData\": {
      \"element\": \"cta_button\",
      \"page\": \"/product\",
      \"button_text\": \"Learn More\"
    }
  }'"

# Test 8: Track Form Submit Event
run_test "Track Form Submit Event (POST /events)" \
  "test_api POST /events '{
    \"sessionId\": \"$TEST_SESSION_ID\",
    \"eventType\": \"form_submit\",
    \"eventData\": {
      \"form_name\": \"newsletter_signup\",
      \"fields\": [\"email\", \"name\"]
    }
  }'"

# Test 9: Track Quiz Start Event
run_test "Track Quiz Start Event (POST /events)" \
  "test_api POST /events '{
    \"sessionId\": \"$TEST_SESSION_ID\",
    \"eventType\": \"quiz_start\",
    \"eventData\": {
      \"quiz_id\": \"product_finder\",
      \"quiz_name\": \"Find Your Product\"
    }
  }'"

# Test 10: Batch Track Events - POST /events/batch
run_test "Batch Track Events (POST /events/batch)" \
  "test_api POST /events/batch '{
    \"events\": [
      {
        \"sessionId\": \"$TEST_SESSION_ID\",
        \"eventType\": \"quiz_complete\",
        \"eventData\": {
          \"score\": 8,
          \"duration_seconds\": 45
        }
      },
      {
        \"sessionId\": \"$TEST_SESSION_ID\",
        \"eventType\": \"product_view\",
        \"eventData\": {
          \"product_id\": \"PROD-123\",
          \"product_name\": \"Test Product\"
        }
      },
      {
        \"sessionId\": \"$TEST_SESSION_ID\",
        \"eventType\": \"checkout_complete\",
        \"eventData\": {
          \"value\": 149.99,
          \"currency\": \"USD\",
          \"items\": 1
        }
      }
    ]
  }'"

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 3: INDIVIDUAL EVENT OPERATIONS${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 11: Get Single Event - GET /events/{sessionId}/{eventId}/{timestamp}
echo -e "${YELLOW}▶ TEST 11: Get Single Event (GET /events/{sessionId}/{eventId}/{timestamp})${NC}"
if [ -n "$TEST_EVENT_ID" ] && [ -n "$TEST_EVENT_TIMESTAMP" ]; then
  response=$(curl -s -X GET "$API_BASE/events/$TEST_SESSION_ID/$TEST_EVENT_ID/$TEST_EVENT_TIMESTAMP")
  echo "$response" | jq '.'
  if echo "$response" | grep -q '"success".*true'; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}  ✓ PASSED${NC}"
  else
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}  ✗ FAILED${NC}"
  fi
else
  echo -e "${RED}  ✗ SKIPPED - No event ID available from previous test${NC}"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
sleep 0.5

# Test 12: Update Event - PATCH /events/{sessionId}/{eventId}/{timestamp}
echo -e "${YELLOW}▶ TEST 12: Update Event (PATCH /events/{sessionId}/{eventId}/{timestamp})${NC}"
if [ -n "$TEST_EVENT_ID" ] && [ -n "$TEST_EVENT_TIMESTAMP" ]; then
  response=$(curl -s -X PATCH "$API_BASE/events/$TEST_SESSION_ID/$TEST_EVENT_ID/$TEST_EVENT_TIMESTAMP" \
    -H "Content-Type: application/json" \
    -d '{
      "eventData": {
        "page": "/homepage",
        "referrer": "google",
        "utm_source": "test",
        "updated": true,
        "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
      }
    }')
  echo "$response" | jq '.'
  if echo "$response" | grep -q '"success".*true'; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}  ✓ PASSED${NC}"
  else
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}  ✗ FAILED${NC}"
  fi
else
  echo -e "${RED}  ✗ SKIPPED - No event ID available from previous test${NC}"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
sleep 0.5

# Test 13: Delete Event - DELETE /events/{sessionId}/{eventId}/{timestamp}
echo -e "${YELLOW}▶ TEST 13: Delete Event (DELETE /events/{sessionId}/{eventId}/{timestamp})${NC}"
if [ -n "$TEST_EVENT_ID" ] && [ -n "$TEST_EVENT_TIMESTAMP" ]; then
  response=$(curl -s -X DELETE "$API_BASE/events/$TEST_SESSION_ID/$TEST_EVENT_ID/$TEST_EVENT_TIMESTAMP")
  echo "$response" | jq '.'
  if echo "$response" | grep -q '"success".*true'; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}  ✓ PASSED${NC}"
  else
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}  ✗ FAILED${NC}"
  fi
else
  echo -e "${RED}  ✗ SKIPPED - No event ID available from previous test${NC}"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
sleep 0.5

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 4: SESSION CLEANUP${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 14: Delete Session - DELETE /sessions/{sessionId}
echo -e "${YELLOW}▶ TEST 14: Delete Session (DELETE /sessions/{sessionId})${NC}"
response=$(curl -s -X DELETE "$API_BASE/sessions/$TEST_SESSION_ID")
echo "$response" | jq '.'
if echo "$response" | grep -q '"success".*true'; then
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "${GREEN}  ✓ PASSED - Session and all events deleted${NC}"
else
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  FAILED_TESTS=$((FAILED_TESTS + 1))
  echo -e "${RED}  ✗ FAILED${NC}"
fi
echo ""
sleep 0.5

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 5: DATA VALIDATION${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 15: Run Data Audit (if available)
if [ -f "src/scripts/audit-data.js" ]; then
  run_test "Data Integrity Audit" \
    "cd src/scripts && AWS_PROFILE=$AWS_PROFILE npm run audit --silent 2>&1 | tail -20"
else
  echo -e "${YELLOW}  ⊘ SKIPPED - audit-data.js not found${NC}"
  echo ""
fi

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PART 6: INFRASTRUCTURE VALIDATION${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test 16: Check CloudFormation Stack
if command -v aws &> /dev/null; then
  run_test "CloudFormation Stack Status" \
    "aws cloudformation describe-stacks \
      --stack-name session-tracking-dev \
      --region $AWS_REGION \
      --profile $AWS_PROFILE \
      --query 'Stacks[0].StackStatus' \
      --output text 2>/dev/null | grep -q 'CREATE_COMPLETE\|UPDATE_COMPLETE'"

  # Test 17: Check Lambda Function
  run_test "Lambda Function Active" \
    "aws lambda get-function \
      --function-name session-tracking-dev-tracking \
      --region $AWS_REGION \
      --profile $AWS_PROFILE \
      --query 'Configuration.State' \
      --output text 2>/dev/null | grep -q 'Active'"

  # Test 18: Check DynamoDB Table
  run_test "DynamoDB Table Active" \
    "aws dynamodb describe-table \
      --table-name $TABLE_NAME \
      --region $AWS_REGION \
      --profile $AWS_PROFILE \
      --query 'Table.TableStatus' \
      --output text 2>/dev/null | grep -q 'ACTIVE'"
else
  echo -e "${YELLOW}  ⊘ SKIPPED - AWS CLI not available${NC}"
  echo ""
fi

echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                     TEST SUMMARY                           ║${NC}"
echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Total Tests:    ${BOLD}$TOTAL_TESTS${NC}"
echo -e "  ${GREEN}Passed:         $PASSED_TESTS${NC}"
echo -e "  ${RED}Failed:         $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║                                                            ║${NC}"
  echo -e "${BOLD}${GREEN}║              ✓ ALL TESTS PASSED!                           ║${NC}"
  echo -e "${BOLD}${GREEN}║                                                            ║${NC}"
  echo -e "${BOLD}${GREEN}║     Your Session Tracking API is fully operational!       ║${NC}"
  echo -e "${BOLD}${GREEN}║                                                            ║${NC}"
  echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Test session:${NC} $TEST_SESSION_ID"
  echo -e "${CYAN}Test user:${NC} $TEST_USER"
  echo ""
  exit 0
else
  echo -e "${BOLD}${RED}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${RED}║                                                            ║${NC}"
  echo -e "${BOLD}${RED}║              ✗ SOME TESTS FAILED                           ║${NC}"
  echo -e "${BOLD}${RED}║                                                            ║${NC}"
  echo -e "${BOLD}${RED}║     Please review the output above for details            ║${NC}"
  echo -e "${BOLD}${RED}║                                                            ║${NC}"
  echo -e "${BOLD}${RED}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
