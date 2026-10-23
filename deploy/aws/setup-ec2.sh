#!/usr/bin/env bash
# ==============================================================================
# WorkPilot / WORKPILOT — Instant EC2 Setup Script
# ==============================================================================
# Run this on any Ubuntu EC2 instance to prepare the environment in under 60s:
#   curl -sSL https://raw.githubusercontent.com/USER/REPO/main/deploy/aws/setup-ec2.sh | bash
# Or:
#   bash deploy/aws/setup-ec2.sh
# ==============================================================================

set -euo pipefail

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}==============================================================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}🚀 WorkPilot EC2 Environment Setup & Verification${COLOR_RESET}"
echo -e "${COLOR_BLUE}==============================================================================${COLOR_RESET}"

# Require root or sudo privileges
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${COLOR_RED}Error: This setup script must be run as root or with sudo.${COLOR_RESET}"
  echo "Usage: sudo bash deploy/aws/setup-ec2.sh"
  exit 1
fi

echo "📦 Step 1: Updating packages and installing prerequisites..."
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl gnupg git jq unzip wget nginx

# Check Docker installation
if ! command -v docker &>/dev/null; then
  echo "🐳 Step 2: Installing Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "✓ Docker already installed ($(docker --version))"
fi

systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group if user exists
if id -u ubuntu &>/dev/null; then
  usermod -aG docker ubuntu
  echo "✓ Added user 'ubuntu' to docker group"
fi

# Step 3: Configure 4GB Swap Space (essential for low-cost t3.micro & t4g.small instances)
echo "💾 Step 3: Checking Swap Space..."
if [ ! -f /swapfile ] && [ "$(swapon --show | wc -l)" -le 1 ]; then
  echo "Allocating 4GB Swap Space..."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl vm.swappiness=10
  if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
  fi
  echo "✓ 4GB Swap Space active"
else
  echo "✓ Swap space already configured"
fi

# Check AWS SSM Agent
echo "📡 Step 4: Checking Amazon SSM Agent..."
if systemctl is-active --quiet snap.amazon-ssm-agent.amazon-ssm-agent.service 2>/dev/null || systemctl is-active --quiet amazon-ssm-agent 2>/dev/null; then
  echo "✓ Amazon SSM Agent is running"
else
  echo "Installing / starting Amazon SSM Agent..."
  if command -v snap &>/dev/null; then
    snap install amazon-ssm-agent --classic || true
    systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service || true
    systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service || true
  fi
fi

# Prepare application folder
echo "📁 Step 5: Ensuring /home/ubuntu/app directory..."
mkdir -p /home/ubuntu/app
if id -u ubuntu &>/dev/null; then
  chown -R ubuntu:ubuntu /home/ubuntu/app
fi

# Step 6: Enable and configure Nginx
echo "🌐 Step 6: Configuring Nginx reverse proxy..."
systemctl enable nginx
systemctl start nginx

echo ""
echo -e "${COLOR_GREEN}==============================================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}✅ EC2 Host is 100% Ready for WorkPilot Deployments!${COLOR_RESET}"
echo -e "${COLOR_GREEN}==============================================================================${COLOR_RESET}"
echo "Next steps:"
echo "1. Clone or pull repo:   cd /home/ubuntu/app && git clone <REPO_URL> ."
echo "2. Copy production env:  cp .env.production.example .env && nano .env"
echo "3. Run deployment:       bash scripts/deploy-production.sh"
echo ""
