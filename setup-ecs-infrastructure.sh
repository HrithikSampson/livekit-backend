#!/bin/bash

# Setup ECS Infrastructure for LiveKit App
# Run this script once to create the necessary ECS infrastructure

set -e

AWS_REGION="ap-south-1"
PROJECT_NAME="livekit-app"
ACCOUNT_ID="497816397337"

echo "Setting up ECS infrastructure for LiveKit app..."

# Create ECS Cluster
echo "Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "${PROJECT_NAME}-cluster" \
  --region $AWS_REGION || echo "Cluster may already exist"

# Create CloudWatch Log Group
echo "Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name "/ecs/${PROJECT_NAME}-backend" \
  --region $AWS_REGION || echo "Log group may already exist"

# Create ECS Task Definition
echo "Creating ECS task definition..."
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region $AWS_REGION

# Create ECS Service (requires VPC, subnets, security groups, and load balancer)
echo "Note: ECS Service creation requires additional AWS resources:"
echo "- VPC and subnets"
echo "- Security groups"
echo "- Application Load Balancer (optional)"
echo "- IAM roles for ECS tasks"
echo ""
echo "You'll need to create these resources or use an existing VPC setup."
echo "The task definition has been created and can be used in your service."

echo "ECS infrastructure setup completed!"
