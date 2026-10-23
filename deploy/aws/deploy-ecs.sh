#!/usr/bin/env bash
# ==============================================================================
# WorkPilot / WORKPILOT — AWS ECS Fargate Automated Deployment Script
# ==============================================================================
# Builds, tags, and pushes server & client container images to AWS ECR,
# updates the ECS task definition, and forces a new service deployment.
#
# Prerequisites:
#   - AWS CLI v2 configured with IAM permissions (or running in CI/CD)
#   - Docker running locally or on CI runner
#
# Usage:
#   AWS_REGION=us-east-1 AWS_ACCOUNT_ID=123456789012 bash deploy/aws/deploy-ecs.sh
# ==============================================================================

set -euo pipefail

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-workpilot-cluster}"
SERVICE_NAME="${ECS_SERVICE_NAME:-workpilot-service}"
TASK_FAMILY="${ECS_TASK_FAMILY:-workpilot-production}"

if [ -z "${AWS_ACCOUNT_ID}" ]; then
  echo -e "${COLOR_RED}Error: AWS_ACCOUNT_ID could not be determined. Please export AWS_ACCOUNT_ID or configure AWS credentials.${COLOR_RESET}"
  exit 1
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
SERVER_IMAGE="${ECR_REGISTRY}/workpilot-server:latest"
CLIENT_IMAGE="${ECR_REGISTRY}/workpilot-client:latest"

echo -e "${COLOR_BLUE}==============================================================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}🚀 Deploying WorkPilot to AWS ECS Fargate${COLOR_RESET}"
echo -e "${COLOR_BLUE}==============================================================================${COLOR_RESET}"
echo "AWS Region:     ${AWS_REGION}"
echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "ECR Registry:   ${ECR_REGISTRY}"
echo "ECS Cluster:    ${CLUSTER_NAME}"
echo "ECS Service:    ${SERVICE_NAME}"
echo ""

# 1. Authenticate Docker with AWS ECR
echo "🔑 Step 1: Authenticating Docker with ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# 2. Ensure ECR Repositories Exist
echo "📦 Step 2: Verifying ECR repositories..."
aws ecr describe-repositories --repository-names workpilot-server --region "${AWS_REGION}" &>/dev/null || \
  aws ecr create-repository --repository-name workpilot-server --region "${AWS_REGION}"

aws ecr describe-repositories --repository-names workpilot-client --region "${AWS_REGION}" &>/dev/null || \
  aws ecr create-repository --repository-name workpilot-client --region "${AWS_REGION}"

# 3. Build & Tag Server Image
echo "🔨 Step 3: Building server image..."
docker build -t "${SERVER_IMAGE}" -f server/Dockerfile ./server

# 4. Build & Tag Client Image
echo "🔨 Step 4: Building client image..."
docker build -t "${CLIENT_IMAGE}" -f client/Dockerfile ./client

# 5. Push Images to ECR
echo "⬆️ Step 5: Pushing images to ECR..."
docker push "${SERVER_IMAGE}"
docker push "${CLIENT_IMAGE}"

# 6. Render Task Definition with Actual Account ID and Region
echo "📝 Step 6: Rendering task definition..."
RENDERED_TASK_DEF="/tmp/workpilot-task-def-$$.json"
sed -e "s/ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" \
    -e "s/REGION/${AWS_REGION}/g" \
    deploy/aws/ecs-task-definition.json > "${RENDERED_TASK_DEF}"

# 7. Register New Task Definition Revision
echo "📋 Step 7: Registering task definition with ECS..."
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${RENDERED_TASK_DEF}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

rm -f "${RENDERED_TASK_DEF}"
echo "✓ Registered Task Definition: ${TASK_DEF_ARN}"

# 8. Trigger Rolling ECS Service Update
echo "🔄 Step 8: Updating ECS service..."
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${SERVICE_NAME}" \
  --task-definition "${TASK_DEF_ARN}" \
  --force-new-deployment \
  --region "${AWS_REGION}"

echo ""
echo -e "${COLOR_GREEN}==============================================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}✅ AWS ECS Fargate Deployment Triggered Successfully!${COLOR_RESET}"
echo -e "${COLOR_GREEN}==============================================================================${COLOR_RESET}"
echo "CloudWatch Logs: /ecs/workpilot-production"
echo "Check rollout status:"
echo "  aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION} --query 'services[0].deployments'"
echo ""
