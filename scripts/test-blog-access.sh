#!/bin/bash

# Blog Access Test Script
# This script tests that unauthenticated users can access public blog endpoints
# and that authenticated users are required for action endpoints

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3099}"
API_BASE="${BASE_URL}/api/blog"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Blog Access Test Script"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "API Base: $API_BASE"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test an endpoint
test_endpoint() {
  local METHOD=$1
  local ENDPOINT=$2
  local EXPECTED_STATUS=$3
  local DESCRIPTION=$4
  local DATA=$5
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  echo -n "Test $TESTS_RUN: $DESCRIPTION... "
  
  if [ -n "$DATA" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "$DATA")
  else
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "$ENDPOINT" \
      -H "Content-Type: application/json")
  fi
  
  if [ "$HTTP_STATUS" = "$EXPECTED_STATUS" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $HTTP_STATUS)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAIL${NC} (Expected HTTP $EXPECTED_STATUS, got HTTP $HTTP_STATUS)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

echo "======================================"
echo "Testing Public Endpoints (No Auth)"
echo "======================================"
echo ""

# Test public GET endpoints - these should return 200 (or 404 if no data)
test_endpoint "GET" "$API_BASE" "200" "GET /api/blog (list all blogs)"
test_endpoint "GET" "$API_BASE/published" "200" "GET /api/blog/published (list published)"

echo ""
echo "======================================"
echo "Testing Protected Endpoints (No Auth)"
echo "======================================"
echo ""

# Test protected endpoints - these should return 401
test_endpoint "POST" "$API_BASE" "401" "POST /api/blog (create - should require auth)" \
  '{"title":"Test","content":"Test content","excerpt":"Test excerpt"}'

test_endpoint "PATCH" "$API_BASE/test-id" "401" "PATCH /api/blog/:id (update - should require auth)" \
  '{"title":"Updated"}'

test_endpoint "DELETE" "$API_BASE/test-id" "401" "DELETE /api/blog/:id (delete - should require auth)"

test_endpoint "POST" "$API_BASE/test-id/vote" "401" "POST /api/blog/:id/vote (vote - should require auth)" \
  '{"type":"LIKE"}'

test_endpoint "POST" "$API_BASE/test-id/comments" "401" "POST /api/blog/:id/comments (comment - should require auth)" \
  '{"content":"Test comment"}'

test_endpoint "POST" "$API_BASE/test-id/share" "401" "POST /api/blog/:id/share (share - should require auth)" \
  '{"platform":"TWITTER"}'

echo ""
echo "======================================"
echo "Test Results"
echo "======================================"
echo "Total Tests: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Blog access is configured correctly:"
  echo "- Public endpoints are accessible without authentication"
  echo "- Protected endpoints require authentication"
  exit 0
else
  echo -e "${RED}✗ Some tests failed!${NC}"
  echo ""
  echo "Please check:"
  echo "1. Server is running at $BASE_URL"
  echo "2. Blog endpoints are properly configured"
  echo "3. AuthGuard is correctly implementing public route handling"
  exit 1
fi
