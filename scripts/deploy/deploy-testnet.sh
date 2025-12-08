#!/bin/bash
# Complete AWS Testnet Deployment Script
# Orchestrates infrastructure, contracts, and applications

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="testnet"
AWS_REGION=${AWS_REGION:-us-east-1}
SKIP_TERRAFORM=${SKIP_TERRAFORM:-false}
SKIP_CONTRACTS=${SKIP_CONTRACTS:-false}
SKIP_APPS=${SKIP_APPS:-false}
SKIP_VERIFICATION=${SKIP_VERIFICATION:-false}

echo -e "${BLUE}"
echo "============================================================"
echo "Jeju Network - AWS Testnet Deployment"
echo "============================================================"
echo -e "${NC}"
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"
echo "Project Root: $PROJECT_ROOT"
echo ""

# ============================================================
# Pre-flight Checks
# ============================================================
echo -e "${BLUE}[0/6] Pre-flight Checks${NC}"
echo "------------------------------------------------------------"

# Check required tools
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not installed"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform not installed"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl not installed"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "❌ Helm not installed"; exit 1; }
command -v helmfile >/dev/null 2>&1 || { echo "❌ Helmfile not installed"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
command -v forge >/dev/null 2>&1 || { echo "❌ Foundry not installed"; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "❌ Bun not installed"; exit 1; }

# Check AWS credentials
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo -e "${RED}❌ AWS credentials not configured${NC}"
  echo "Run: aws configure"
  exit 1
fi
echo "✅ AWS Account: $AWS_ACCOUNT_ID"

# Check environment file
if [ ! -f "$PROJECT_ROOT/.env.testnet" ]; then
  echo -e "${YELLOW}⚠️  .env.testnet not found${NC}"
  echo "Creating from template..."
  cp "$PROJECT_ROOT/.env.testnet.example" "$PROJECT_ROOT/.env.testnet"
  echo -e "${RED}❌ Please configure .env.testnet before continuing${NC}"
  exit 1
fi

# Load environment
source "$PROJECT_ROOT/.env.testnet"

# Verify critical env vars
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  echo -e "${RED}❌ DEPLOYER_PRIVATE_KEY not set in .env.testnet${NC}"
  exit 1
fi

echo "✅ All pre-flight checks passed"
echo ""

# ============================================================
# Step 1: Deploy Infrastructure (Terraform)
# ============================================================
if [ "$SKIP_TERRAFORM" != "true" ]; then
  echo -e "${BLUE}[1/6] Deploying AWS Infrastructure${NC}"
  echo "------------------------------------------------------------"
  
  cd "$PROJECT_ROOT/packages/terraform/environments/testnet"
  
  echo "Initializing Terraform..."
  terraform init
  
  echo "Planning infrastructure..."
  terraform plan -out=tfplan
  
  echo "Applying infrastructure..."
  terraform apply -auto-approve tfplan
  
  echo "Extracting outputs..."
  EKS_CLUSTER_NAME=$(terraform output -raw eks_cluster_name)
  RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
  
  echo "✅ Infrastructure deployed"
  echo "   EKS Cluster: $EKS_CLUSTER_NAME"
  echo "   RDS Endpoint: $RDS_ENDPOINT"
  echo ""
else
  echo -e "${YELLOW}[1/6] Skipping infrastructure deployment${NC}"
  echo ""
fi

# ============================================================
# Step 2: Configure kubectl
# ============================================================
echo -e "${BLUE}[2/6] Configuring kubectl${NC}"
echo "------------------------------------------------------------"

EKS_CLUSTER_NAME=${EKS_CLUSTER_NAME:-jeju-testnet-eks}
aws eks update-kubeconfig --name $EKS_CLUSTER_NAME --region $AWS_REGION

echo "✅ kubectl configured for $EKS_CLUSTER_NAME"
echo ""

# ============================================================
# Step 3: Build and Push Docker Images
# ============================================================
echo -e "${BLUE}[3/6] Building and Pushing Docker Images${NC}"
echo "------------------------------------------------------------"

"$SCRIPT_DIR/build-and-push-images.sh" $ENVIRONMENT

echo "✅ All images built and pushed"
echo ""

# ============================================================
# Step 4: Deploy Smart Contracts
# ============================================================
if [ "$SKIP_CONTRACTS" != "true" ]; then
  echo -e "${BLUE}[4/6] Deploying Smart Contracts${NC}"
  echo "------------------------------------------------------------"
  
  cd "$PROJECT_ROOT/packages/contracts"
  
  # Deploy main liquidity system
  echo "Deploying liquidity system..."
  forge script script/DeployLiquiditySystem.s.sol:DeployLiquiditySystem \
    --rpc-url $JEJU_RPC_URL \
    --broadcast \
    --verify
  
  # Deploy game tokens
  echo "Deploying game tokens..."
  forge script script/DeployGameTokens.s.sol:DeployGameTokens \
    --rpc-url $JEJU_RPC_URL \
    --broadcast
  
  # Deploy bazaar marketplace
  echo "Deploying bazaar marketplace..."
  forge script script/DeployBazaarMarketplace.s.sol:DeployBazaarMarketplace \
    --rpc-url $JEJU_RPC_URL \
    --broadcast
  
  echo "✅ Smart contracts deployed"
  echo ""
else
  echo -e "${YELLOW}[4/6] Skipping contract deployment${NC}"
  echo ""
fi

# ============================================================
# Step 5: Deploy Applications to Kubernetes
# ============================================================
if [ "$SKIP_APPS" != "true" ]; then
  echo -e "${BLUE}[5/6] Deploying Applications to Kubernetes${NC}"
  echo "------------------------------------------------------------"
  
  cd "$PROJECT_ROOT/packages/kubernetes/helmfile"
  
  # Create namespaces
  kubectl create namespace jeju-apps --dry-run=client -o yaml | kubectl apply -f -
  kubectl create namespace jeju-rpc --dry-run=client -o yaml | kubectl apply -f -
  kubectl create namespace jeju-indexer --dry-run=client -o yaml | kubectl apply -f -
  kubectl create namespace jeju-monitoring --dry-run=client -o yaml | kubectl apply -f -
  
  # Deploy with helmfile
  helmfile -e testnet sync
  
  # Wait for rollouts
  echo "Waiting for deployments to stabilize..."
  kubectl rollout status deployment/bazaar -n jeju-apps --timeout=10m
  kubectl rollout status deployment/gateway -n jeju-apps --timeout=10m
  kubectl rollout status statefulset/reth-rpc -n jeju-rpc --timeout=15m
  
  echo "✅ Applications deployed"
  echo ""
else
  echo -e "${YELLOW}[5/6] Skipping application deployment${NC}"
  echo ""
fi

# ============================================================
# Step 6: Verification
# ============================================================
if [ "$SKIP_VERIFICATION" != "true" ]; then
  echo -e "${BLUE}[6/6] Verifying Deployment${NC}"
  echo "------------------------------------------------------------"
  
  cd "$PROJECT_ROOT"
  
  # Check pod status
  echo "Checking pod status..."
  kubectl get pods -n jeju-apps
  kubectl get pods -n jeju-rpc
  
  # Health checks
  echo ""
  echo "Running health checks..."
  bun run scripts/verify-cloud-deployment.ts
  
  echo "✅ Verification complete"
  echo ""
else
  echo -e "${YELLOW}[6/6] Skipping verification${NC}"
  echo ""
fi

# ============================================================
# Deployment Complete
# ============================================================
echo -e "${GREEN}"
echo "============================================================"
echo "✅ AWS Testnet Deployment Complete!"
echo "============================================================"
echo -e "${NC}"
echo ""
echo "Endpoints:"
echo "  RPC:         https://rpc.testnet.jeju.network"
echo "  Explorer:    https://explorer.testnet.jeju.network"
echo "  Bazaar:      https://bazaar.testnet.jeju.network"
echo "  Gateway:     https://gateway.testnet.jeju.network"
echo "  Docs:        https://docs.testnet.jeju.network"
echo "  Leaderboard: https://leaderboard.testnet.jeju.network"
echo "  Indexer:     https://indexer.testnet.jeju.network"
echo ""
echo "Monitoring:"
echo "  Grafana:     https://grafana.testnet.jeju.network"
echo "  Prometheus:  https://prometheus.testnet.jeju.network"
echo ""
echo "Management:"
echo "  kubectl get pods -n jeju-apps"
echo "  kubectl logs -f deployment/bazaar -n jeju-apps"
echo "  helmfile -e testnet status"
echo ""
echo "To destroy:"
echo "  ./scripts/deploy/destroy-testnet.sh"

