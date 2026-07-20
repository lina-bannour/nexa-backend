#!/bin/bash
set -e
BASE="http://localhost:3000"

echo "=== Login A ==="
TOKEN_A=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"a@nexa.tn","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "TOKEN_A length: ${#TOKEN_A}"

echo "=== Login B ==="
TOKEN_B=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"b@nexa.tn","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "TOKEN_B length: ${#TOKEN_B}"

echo "=== Create post as A ==="
POST_ID=$(curl -s -X POST "$BASE/forum" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"titre":"Test likedByMe","contenu":"...","matiere":"MATHEMATIQUES"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "POST_ID=$POST_ID"

echo "=== Like as A ==="
curl -s -X POST "$BASE/forum/$POST_ID/like" -H "Authorization: Bearer $TOKEN_A"
echo ""

echo "=== View as A (likedByMe should be true) ==="
curl -s "$BASE/forum/$POST_ID" -H "Authorization: Bearer $TOKEN_A" | python3 -m json.tool | grep -i liked

echo "=== View as B (likedByMe should be false) ==="
curl -s "$BASE/forum/$POST_ID" -H "Authorization: Bearer $TOKEN_B" | python3 -m json.tool | grep -i liked
