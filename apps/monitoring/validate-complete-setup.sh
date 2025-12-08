#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   MONITORING SETUP VALIDATION                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# ============================================================================
# 1. CONFIGURATION FILES
# ============================================================================

echo "1. CONFIGURATION FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "docker-compose.yml" ]; then
    echo "✅ docker-compose.yml exists"
else
    echo "❌ docker-compose.yml missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "prometheus/prometheus.yml" ]; then
    echo "✅ prometheus/prometheus.yml exists"
else
    echo "❌ prometheus/prometheus.yml missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "grafana/provisioning/datasources/datasources.yml" ]; then
    echo "✅ Datasources config exists"
    if grep -q "uid: prometheus" grafana/provisioning/datasources/datasources.yml; then
        echo "   ✅ Prometheus UID configured"
    else
        echo "   ❌ Prometheus UID not set"
        ERRORS=$((ERRORS + 1))
    fi
    if grep -q "uid: postgres-indexer" grafana/provisioning/datasources/datasources.yml; then
        echo "   ✅ PostgreSQL UID configured"
    else
        echo "   ❌ PostgreSQL UID not set"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Datasources config missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "grafana/provisioning/dashboards/dashboards.yml" ]; then
    echo "✅ Dashboard provisioning config exists"
else
    echo "❌ Dashboard provisioning config missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# 2. DASHBOARDS
# ============================================================================

echo "2. DASHBOARD FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DASHBOARD_COUNT=$(find grafana/dashboards -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
if [ "$DASHBOARD_COUNT" -ge "9" ]; then
    echo "✅ Found $DASHBOARD_COUNT dashboards"
else
    echo "⚠️  Found $DASHBOARD_COUNT dashboards (expected 9+)"
    WARNINGS=$((WARNINGS + 1))
fi

echo "   Checking dashboard UIDs..."
for dashboard in grafana/dashboards/*.json; do
    filename=$(basename "$dashboard")
    if grep -q '"uid":' "$dashboard"; then
        echo "   ✅ $filename has UID"
    else
        echo "   ❌ $filename missing UID"
        ERRORS=$((ERRORS + 1))
    fi
done

echo "   Validating JSON syntax..."
JSON_ERRORS=0
for dashboard in grafana/dashboards/*.json; do
    filename=$(basename "$dashboard")
    if python3 -m json.tool "$dashboard" > /dev/null 2>&1; then
        : # Valid
    else
        echo "   ❌ $filename has invalid JSON"
        JSON_ERRORS=$((JSON_ERRORS + 1))
    fi
done

if [ "$JSON_ERRORS" -eq "0" ]; then
    echo "   ✅ All dashboards have valid JSON"
else
    ERRORS=$((ERRORS + JSON_ERRORS))
fi

echo ""

# ============================================================================
# 3. NETWORK CONFIGURATION
# ============================================================================

echo "3. NETWORK CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "extra_hosts:" docker-compose.yml; then
    echo "✅ Extra hosts configured"
else
    echo "⚠️  Extra hosts not configured"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "jeju-monitoring" docker-compose.yml; then
    echo "✅ jeju-monitoring network defined"
else
    echo "❌ jeju-monitoring network missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# 4. SCRIPTS
# ============================================================================

echo "4. SCRIPTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -x "start-monitoring.sh" ]; then
    echo "✅ start-monitoring.sh is executable"
else
    echo "❌ start-monitoring.sh not executable or missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -x "verify-setup.sh" ]; then
    echo "✅ verify-setup.sh is executable"
else
    echo "⚠️  verify-setup.sh not executable"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# 5. RUNTIME CHECK
# ============================================================================

echo "5. RUNTIME CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker ps | grep -q jeju-grafana; then
    echo "✅ Grafana container is running"
    
    if curl -s http://localhost:4010/api/health > /dev/null 2>&1; then
        echo "   ✅ Grafana API is responding"
    else
        echo "   ⚠️  Grafana API not responding yet"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "ℹ️  Grafana not running (start with ./start-monitoring.sh)"
fi

if docker ps | grep -q jeju-prometheus; then
    echo "✅ Prometheus container is running"
    
    if curl -s http://localhost:9090/api/v1/targets > /dev/null 2>&1; then
        echo "   ✅ Prometheus API is responding"
    else
        echo "   ⚠️  Prometheus API not responding yet"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "ℹ️  Prometheus not running (start with ./start-monitoring.sh)"
fi

if docker ps | grep -q squid-db-1; then
    echo "✅ Indexer database is running"
else
    echo "ℹ️  Indexer database not running"
    echo "   PostgreSQL dashboards will show 'No data' until started"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "═══════════════════════════════════════════════════════════════"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo ""
    echo "✅ PERFECT - Everything is configured correctly."
    echo ""
elif [ "$ERRORS" -eq 0 ]; then
    echo ""
    echo "✅ READY with $WARNINGS warning(s)"
    echo ""
else
    echo ""
    echo "❌ ISSUES FOUND: $ERRORS error(s), $WARNINGS warning(s)"
    echo ""
fi

echo "Quick actions:"
echo "  Start monitoring: ./start-monitoring.sh"
echo "  View logs: docker-compose logs -f"
echo "  Stop monitoring: docker-compose down"
echo ""

exit $ERRORS
