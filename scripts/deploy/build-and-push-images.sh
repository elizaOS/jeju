#!/bin/bash
# Build and push all Docker images to ECR (with proper build context)
# Usage: ./scripts/deploy/build-and-push-images-updated.sh [environment]

set -e

ENVIRONMENT=${1:-testnet}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# App configurations: name, dockerfile path, build context
declare -A APPS=(
  ["bazaar"]="apps/bazaar/Dockerfile:apps/bazaar"
  ["gateway"]="apps/gateway/Dockerfile:apps/gateway"
  ["leaderboard"]="apps/leaderboard/Dockerfile:apps/leaderboard"
  ["ipfs"]="apps/ipfs/Dockerfile:apps/ipfs"
  ["documentation"]="apps/documentation/Dockerfile:." # Needs project root for config
  ["crucible"]="apps/crucible2/packages/agentserver/Dockerfile:apps/crucible2"
  ["ehorse"]="apps/ehorse/Dockerfile:apps/ehorse"
)

echo "============================================================"
echo "Building and Pushing Docker Images"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "ECR Registry: $ECR_REGISTRY"
echo "Project Root: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# Login to ECR
echo "[1/3] Logging into Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY
echo "✅ ECR login successful"
echo ""

# Build and push each app
echo "[2/3] Building and pushing images..."
for app in "${!APPS[@]}"; do
  echo ""
  echo "------------------------------------------------------------"
  echo "Building: $app"
  echo "------------------------------------------------------------"
  
  IFS=':' read -r dockerfile context <<< "${APPS[$app]}"
  
  if [ ! -f "$dockerfile" ]; then
    echo "⚠️  No Dockerfile found at $dockerfile, skipping..."
    continue
  fi
  
  # Build image
  IMAGE_NAME="jeju/$app"
  IMAGE_TAG="${ENVIRONMENT}-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
  FULL_IMAGE="${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
  LATEST_IMAGE="${ECR_REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-latest"
  
  echo "Context: $context"
  echo "Dockerfile: $dockerfile"
  echo "Building: $FULL_IMAGE"
  
  docker build \
    -f "$dockerfile" \
    -t "$FULL_IMAGE" \
    -t "$LATEST_IMAGE" \
    --platform linux/amd64 \
    --build-arg ENVIRONMENT=$ENVIRONMENT \
    "$context" || {
      echo "❌ Build failed for $app"
      exit 1
    }
  
  # Push both tags
  echo "Pushing: $FULL_IMAGE"
  docker push "$FULL_IMAGE"
  
  echo "Pushing: $LATEST_IMAGE"
  docker push "$LATEST_IMAGE"
  
  echo "✅ $app pushed successfully"
done

echo ""
echo "[3/3] Summary"
echo "============================================================"
for app in "${!APPS[@]}"; do
  echo "✅ $app: ${ECR_REGISTRY}/jeju/$app:${ENVIRONMENT}-latest"
done

echo ""
echo "============================================================"
echo "All images built and pushed successfully!"
echo "============================================================"

