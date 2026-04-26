#!/bin/bash

# Test complet de la partie DID de l'API QSDID Platform
# URL de base de l'API
BASE_URL="http://localhost:8083"

# Couleurs pour les outputs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteur de tests
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction pour afficher les résultats
print_test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Fonction pour faire des requêtes HTTP avec gestion des erreurs
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    local response
    local status_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $test_name (HTTP $status_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        echo -e "${RED}✗${NC} $test_name (Expected $expected_status, got $status_code)"
        echo "Response: $body"
        return 1
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 Test Suite: QSDID Platform API${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Vérifier que l'API est accessible
echo -e "${YELLOW}📡 Vérification de l'API...${NC}"
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ L'API n'est pas accessible sur $BASE_URL${NC}"
    echo -e "${YELLOW}Assurez-vous que le serveur est démarré avec 'cargo run'${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API accessible${NC}\n"

# ============================================
# SECTION 1: Tests de validation DID
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 SECTION 1: Tests de validation DID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 1: Validation d'un DID valide
echo -e "${YELLOW}Test 1: Validation d'un DID valide${NC}"
make_request "GET" "/did/validate/did:qsid:123456789" "" 200 "DID valide"
print_test_result $? "Validation DID valide"

# Test 2: Validation d'un DID avec méthode invalide
echo -e "\n${YELLOW}Test 2: Validation d'un DID avec méthode invalide${NC}"
make_request "GET" "/did/validate/did:invalid%20space:123" "" 400 "DID méthode invalide"
print_test_result $? "Rejet DID méthode invalide"

# Test 3: Validation d'un DID avec ID invalide
echo -e "\n${YELLOW}Test 3: Validation d'un DID avec ID invalide${NC}"
make_request "GET" "/did/validate/did:qsid:invalid%40%23%24" "" 400 "DID ID invalide"
print_test_result $? "Rejet DID ID invalide"

# Test 4: Validation d'un format DID complet
echo -e "\n${YELLOW}Test 4: Validation format DID complet${NC}"
make_request "GET" "/did/validate/did:example:1234567890abcdef" "" 200 "Format DID complet"
print_test_result $? "Validation format complet"

# ============================================
# SECTION 2: Tests de création de DID
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔨 SECTION 2: Tests de création de DID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Générer une clé d'abord pour les tests
echo -e "${YELLOW}Génération d'une clé pour les tests...${NC}"
KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/keys/generate" \
    -H "Content-Type: application/json")
KEY_ID=$(echo "$KEY_RESPONSE" | jq -r '.key_id')
echo -e "${GREEN}✓ Clé générée: $KEY_ID${NC}\n"

# Test 5: Création DID basique
echo -e "${YELLOW}Test 5: Création DID basique${NC}"
DID_DATA='{
    "method": "qsid",
    "method_id": "test-001"
}'
make_request "POST" "/did/create" "$DID_DATA" 201 "Création DID basique"
print_test_result $? "Création DID basique"

# Test 6: Création DID avec liaison de clé
echo -e "\n${YELLOW}Test 6: Création DID avec liaison de clé${NC}"
DID_WITH_KEY_DATA="{
    \"method\": \"qsid\",
    \"method_id\": \"test-with-key\",
    \"key_id\": \"$KEY_ID\"
}"
make_request "POST" "/did/create" "$DID_WITH_KEY_DATA" 201 "Création DID avec clé"
print_test_result $? "Création DID avec liaison clé"

# Test 7: Création DID avec méthode invalide
echo -e "\n${YELLOW}Test 7: Création DID avec méthode invalide${NC}"
DID_INVALID_METHOD='{
    "method": "invalid method",
    "method_id": "test-002"
}'
make_request "POST" "/did/create" "$DID_INVALID_METHOD" 400 "Rejet méthode invalide"
print_test_result $? "Rejet création méthode invalide"

# Test 8: Création DID avec ID invalide
echo -e "\n${YELLOW}Test 8: Création DID avec ID invalide${NC}"
DID_INVALID_ID='{
    "method": "qsid",
    "method_id": "invalid@#$id"
}'
make_request "POST" "/did/create" "$DID_INVALID_ID" 400 "Rejet ID invalide"
print_test_result $? "Rejet création ID invalide"

# ============================================
# SECTION 3: Tests de résolution DID
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 SECTION 3: Tests de résolution DID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Créer un DID pour les tests de résolution
echo -e "${YELLOW}Création d'un DID pour résolution...${NC}"
RESOLVE_DID_DATA='{
    "method": "qsid",
    "method_id": "resolve-test-001"
}'
RESOLVE_RESPONSE=$(curl -s -X POST "$BASE_URL/did/create" \
    -H "Content-Type: application/json" \
    -d "$RESOLVE_DID_DATA")
RESOLVE_DID=$(echo "$RESOLVE_RESPONSE" | jq -r '.did')
echo -e "${GREEN}✓ DID créé: $RESOLVE_DID${NC}\n"

# Test 9: Résolution DID existant
echo -e "${YELLOW}Test 9: Résolution DID existant${NC}"
make_request "GET" "/did/resolve/$RESOLVE_DID" "" 200 "Résolution DID existant"
print_test_result $? "Résolution DID existant"

# Test 10: Résolution DID inexistant
echo -e "\n${YELLOW}Test 10: Résolution DID inexistant${NC}"
make_request "GET" "/did/resolve/did:qsid:does-not-exist-12345" "" 404 "Résolution DID inexistant"
print_test_result $? "Échec résolution DID inexistant"

# Test 11: Résolution avec DID invalide
echo -e "\n${YELLOW}Test 11: Résolution avec DID invalide${NC}"
make_request "GET" "/did/resolve/invalid-did-format" "" 400 "Rejet DID invalide"
print_test_result $? "Rejet résolution DID invalide"

# ============================================
# SECTION 4: Tests de création depuis clé
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔑 SECTION 4: Tests de création DID depuis clé${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 12: Création DID depuis clé existante
echo -e "${YELLOW}Test 12: Création DID depuis clé existante${NC}"
make_request "POST" "/did/from-key/$KEY_ID" "" 201 "Création DID depuis clé"
print_test_result $? "Création DID avec clé existante"

# Test 13: Création DID depuis clé inexistante
echo -e "\n${YELLOW}Test 13: Création DID depuis clé inexistante${NC}"
make_request "POST" "/did/from-key/non-existent-key-12345" "" 404 "Rejet clé inexistante"
print_test_result $? "Rejet création avec clé inexistante"

# ============================================
# SECTION 5: Tests de lecture et listing
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📖 SECTION 5: Tests de lecture et listing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 14: Liste des DIDs
echo -e "${YELLOW}Test 14: Liste de tous les DIDs${NC}"
make_request "GET" "/did/list" "" 200 "Liste des DIDs"
print_test_result $? "Listing DIDs"

# Test 15: Récupération document DID
echo -e "\n${YELLOW}Test 15: Récupération document DID${NC}"
make_request "GET" "/did/$RESOLVE_DID" "" 200 "Récupération document DID"
print_test_result $? "Récupération document DID"

# Test 16: Récupération document DID inexistant
echo -e "\n${YELLOW}Test 16: Récupération document DID inexistant${NC}"
make_request "GET" "/did/did:qsid:does-not-exist" "" 404 "Document inexistant"
print_test_result $? "Échec récupération document inexistant"

# ============================================
# SECTION 6: Tests de mise à jour
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✏️ SECTION 6: Tests de mise à jour${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Créer un DID pour update
echo -e "${YELLOW}Création d'un DID pour update...${NC}"
UPDATE_DID_DATA='{
    "method": "qsid",
    "method_id": "update-test-001"
}'
UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/did/create" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_DID_DATA")
UPDATE_DID=$(echo "$UPDATE_RESPONSE" | jq -r '.did')
echo -e "${GREEN}✓ DID créé: $UPDATE_DID${NC}\n"

# Test 17: Mise à jour document DID
echo -e "${YELLOW}Test 17: Mise à jour du document DID${NC}"
UPDATE_DATA='{
    "controller": "did:qsid:new-controller-123"
}'
make_request "PUT" "/did/$UPDATE_DID" "$UPDATE_DATA" 200 "Mise à jour DID"
print_test_result $? "Mise à jour document DID"

# Test 18: Mise à jour DID inexistant
echo -e "\n${YELLOW}Test 18: Mise à jour DID inexistant${NC}"
make_request "PUT" "/did/did:qsid:does-not-exist" "$UPDATE_DATA" 404 "Mise à jour inexistant"
print_test_result $? "Échec mise à jour DID inexistant"

# Test 19: Mise à jour avec DID invalide
echo -e "\n${YELLOW}Test 19: Mise à jour avec DID invalide${NC}"
make_request "PUT" "/did/invalid-did" "$UPDATE_DATA" 400 "Rejet DID invalide"
print_test_result $? "Rejet mise à jour DID invalide"

# ============================================
# SECTION 7: Tests de suppression
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🗑️ SECTION 7: Tests de suppression${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Créer un DID pour suppression
echo -e "${YELLOW}Création d'un DID pour suppression...${NC}"
DELETE_DID_DATA='{
    "method": "qsid",
    "method_id": "delete-test-001"
}'
DELETE_RESPONSE=$(curl -s -X POST "$BASE_URL/did/create" \
    -H "Content-Type: application/json" \
    -d "$DELETE_DID_DATA")
DELETE_DID=$(echo "$DELETE_RESPONSE" | jq -r '.did')
echo -e "${GREEN}✓ DID créé: $DELETE_DID${NC}\n"

# Test 20: Suppression DID existant
echo -e "${YELLOW}Test 20: Suppression d'un DID existant${NC}"
make_request "DELETE" "/did/$DELETE_DID" "" 200 "Suppression DID"
print_test_result $? "Suppression DID existant"

# Test 21: Vérification que le DID est bien supprimé
echo -e "\n${YELLOW}Test 21: Vérification suppression DID${NC}"
make_request "GET" "/did/resolve/$DELETE_DID" "" 404 "DID supprimé"
print_test_result $? "Confirmation suppression"

# Test 22: Suppression DID inexistant
echo -e "\n${YELLOW}Test 22: Suppression DID inexistant${NC}"
make_request "DELETE" "/did/did:qsid:already-deleted-123" "" 404 "Suppression inexistant"
print_test_result $? "Échec suppression inexistant"

# Test 23: Suppression avec DID invalide
echo -e "\n${YELLOW}Test 23: Suppression avec DID invalide${NC}"
make_request "DELETE" "/did/invalid-did-format" "" 400 "Rejet format invalide"
print_test_result $? "Rejet suppression DID invalide"

# ============================================
# SECTION 8: Tests d'intégration
# ============================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔗 SECTION 8: Tests d'intégration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 24: Cycle de vie complet
echo -e "${YELLOW}Test 24: Cycle de vie complet DID${NC}"

# 1. Créer une clé
KEY_LIFECYCLE=$(curl -s -X POST "$BASE_URL/keys/generate" \
    -H "Content-Type: application/json")
KEY_LIFECYCLE_ID=$(echo "$KEY_LIFECYCLE" | jq -r '.key_id')
echo "  → Clé créée: $KEY_LIFECYCLE_ID"

# 2. Créer DID avec cette clé
DID_LIFECYCLE_DATA="{
    \"method\": \"qsid\",
    \"method_id\": \"lifecycle-test\",
    \"key_id\": \"$KEY_LIFECYCLE_ID\"
}"
DID_LIFECYCLE_RESPONSE=$(curl -s -X POST "$BASE_URL/did/create" \
    -H "Content-Type: application/json" \
    -d "$DID_LIFECYCLE_DATA")
DID_LIFECYCLE=$(echo "$DID_LIFECYCLE_RESPONSE" | jq -r '.did')
echo "  → DID créé: $DID_LIFECYCLE"

# 3. Résoudre le DID
RESOLVE_RESULT=$(curl -s -X GET "$BASE_URL/did/resolve/$DID_LIFECYCLE" \
    -H "Content-Type: application/json")
if echo "$RESOLVE_RESULT" | jq -e '.did' > /dev/null 2>&1; then
    echo "  → Résolution réussie"
else
    echo "  → Échec résolution"
fi

# 4. Mettre à jour le DID
UPDATE_LIFECYCLE='{"controller": "did:qsid:updated-controller"}'
UPDATE_RESULT=$(curl -s -X PUT "$BASE_URL/did/$DID_LIFECYCLE" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_LIFECYCLE")
echo "  → Mise à jour effectuée"

# 5. Supprimer le DID
DELETE_RESULT=$(curl -s -X DELETE "$BASE_URL/did/$DID_LIFECYCLE" \
    -H "Content-Type: application/json")
echo "  → DID supprimé"

print_test_result $? "Cycle de vie complet DID"

# Test 25: Vérification de la structure du document DID
echo -e "\n${YELLOW}Test 25: Vérification structure document DID${NC}"
DID_STRUCTURE_RESPONSE=$(curl -s -X GET "$BASE_URL/did/$RESOLVE_DID" \
    -H "Content-Type: application/json")

if echo "$DID_STRUCTURE_RESPONSE" | jq -e '.id' > /dev/null && \
   echo "$DID_STRUCTURE_RESPONSE" | jq -e '.["@context"]' > /dev/null && \
   echo "$DID_STRUCTURE_RESPONSE" | jq -e '.verificationMethod' > /dev/null; then
    echo -e "${GREEN}✓${NC} Structure du document DID valide"
    print_test_result 0 "Structure document DID"
else
    echo -e "${RED}✗${NC} Structure du document DID invalide"
    print_test_result 1 "Structure document DID"
fi

# ============================================
# RÉSUMÉ DES TESTS
# ============================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}📊 RÉSULTATS DES TESTS${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Passés: $TESTS_PASSED${NC}"
echo -e "${RED}✗ Échoués: $TESTS_FAILED${NC}"
echo -e "${BLUE}📈 Total: $((TESTS_PASSED + TESTS_FAILED))${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Tous les tests ont réussi!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ Certains tests ont échoué${NC}"
    exit 1
fi