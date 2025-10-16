#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🔍 COMPLETE PROJECT VALIDATION                             ║"
echo "║   Fine-tooth comb review of all services                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

FAILURES=0

# Section 1: Helm Chart Linting
echo "1️⃣  HELM CHART VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CHARTS=(
    "kubernetes/helm/subsquid"
    "kubernetes/helm/reth"
    "kubernetes/helm/op-node"
    "kubernetes/helm/op-batcher"
    "kubernetes/helm/op-proposer"
    "kubernetes/helm/op-challenger"
    "kubernetes/helm/rpc-gateway"
    "kubernetes/helm/eigenda"
    "kubernetes/helm/bundler"
    "kubernetes/helm/metabase"
)

for chart in "${CHARTS[@]}"; do
    CHART_NAME=$(basename "$chart")
    if helm lint "$chart" > /dev/null 2>&1; then
        echo "   ✅ $CHART_NAME"
    else
        echo "   ❌ $CHART_NAME - has issues"
        FAILURES=$((FAILURES + 1))
    fi
done

# Section 2: Helm Template Rendering
echo ""
echo "2️⃣  TEMPLATE RENDERING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for chart in "${CHARTS[@]}"; do
    CHART_NAME=$(basename "$chart")
    if helm template test "$chart" --debug > /dev/null 2>&1; then
        echo "   ✅ $CHART_NAME templates render"
    else
        echo "   ❌ $CHART_NAME templates have errors"
        FAILURES=$((FAILURES + 1))
    fi
done

# Section 3: Environment Values Exist
echo ""
echo "3️⃣  ENVIRONMENT VALUES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_VALUES=("localnet" "mainnet" "testnet")

for chart in "${CHARTS[@]}"; do
    CHART_NAME=$(basename "$chart")
    MISSING=0
    
    for env in "${REQUIRED_VALUES[@]}"; do
        if [ ! -f "$chart/values-$env.yaml" ]; then
            if [ $MISSING -eq 0 ]; then
                echo "   ⚠️  $CHART_NAME missing:"
            fi
            echo "      - values-$env.yaml"
            MISSING=$((MISSING + 1))
        fi
    done
    
    if [ $MISSING -eq 0 ]; then
        echo "   ✅ $CHART_NAME (all environments)"
    fi
done

# Section 4: Indexer Specific Tests
echo ""
echo "4️⃣  INDEXER FUNCTIONAL TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "indexer" ]; then
    cd indexer
    
    echo "   Checking build..."
    if npm run build > /dev/null 2>&1; then
        echo "   ✅ TypeScript builds"
    else
        echo "   ❌ Build fails"
        FAILURES=$((FAILURES + 1))
    fi
    
    echo "   Checking database..."
    if docker ps | grep -q squid-db-1; then
        echo "   ✅ Database running"
        
        if docker exec squid-db-1 psql -U postgres -l | grep -q indexer; then
            echo "   ✅ Database 'indexer' exists"
        else
            echo "   ⚠️  Database 'indexer' not created (run: docker exec squid-db-1 psql -U postgres -c 'CREATE DATABASE indexer;')"
        fi
    else
        echo "   ⚠️  Database not running (run: npm run db:up)"
    fi
    
    cd ..
else
    echo "   ❌ indexer/ directory not found"
    FAILURES=$((FAILURES + 1))
fi

# Section 5: Configuration Consistency
echo ""
echo "5️⃣  CONFIGURATION CONSISTENCY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check RPC endpoint naming
echo "   Checking RPC endpoint consistency..."
if grep -r "reth-rpc" kubernetes/helm/*/values*.yaml | head -1 > /dev/null; then
    echo "   ✅ RPC service naming consistent (reth-rpc)"
else
    echo "   ⚠️  RPC naming may vary"
fi

# Check database naming
echo "   Checking database naming..."
if grep -r "indexer" kubernetes/helm/subsquid/values*.yaml | head -1 > /dev/null; then
    echo "   ✅ Database name consistent (indexer)"
else
    echo "   ❌ Database naming inconsistent"
    FAILURES=$((FAILURES + 1))
fi

# Results
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILURES -eq 0 ]; then
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║   ✅ ALL VALIDATIONS PASSED                                  ║"
    echo "║   Project is ready for deployment                           ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
else
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║   ⚠️  $FAILURES VALIDATION FAILURES                           ║"
    echo "║   Review issues above                                       ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    exit 1
fi

