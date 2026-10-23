#!/usr/bin/env bash
# ==============================================================================
# WorkPilot / WORKPILOT — AWS EC2 User Data Bootstrap Script
# ==============================================================================
# Paste this script into EC2 Launch Template or "User Data" field when launching
# an Ubuntu 22.04 / 24.04 LTS instance.
#
# It automatically:
# 1. Updates system packages
# 2. Installs Docker CE & Docker Compose plugin
# 3. Installs AWS CLI v2 & AWS Systems Manager (SSM) Agent
# 4. Configures UFW firewall (22, 80, 443)
# 5. Prepares /home/ubuntu/app directory with correct permissions
# 6. Enables docker service on boot
# ==============================================================================

set -euo pipefail
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "================================================================"
echo "🚀 WorkPilot AWS EC2 Bootstrapping Started: $(date -u)"
echo "================================================================"

export DEBIAN_FRONTEND=noninteractive

# 1. Update and install base utilities
echo "📦 [1/6] Updating apt packages..."
apt-get update -y
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    jq \
    unzip \
    ufw \
    wget

# 2. Install official Docker CE and Docker Compose plugin
echo "🐳 [2/6] Installing Docker CE and Compose plugin..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# 3. Provision 4GB Swap Space (Critical for cheap/free-tier t3.micro & t4g.small instances)
echo "💾 [3/7] Provisioning 4GB Swap Space..."
if [ ! -f /swapfile ]; then
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
  echo "✓ 4GB Swap Space activated with vm.swappiness=10"
fi

# 4. Install AWS CLI v2
echo "☁️ [4/7] Installing AWS CLI v2..."
if ! command -v aws &>/dev/null; then
  cd /tmp
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  ./aws/install --update
  rm -rf aws awscliv2.zip
  cd -
fi

# 5. Ensure Amazon SSM Agent is installed and active
echo "📡 [5/7] Verifying Amazon SSM Agent..."
if command -v snap &>/dev/null; then
  snap install amazon-ssm-agent --classic || true
  systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service || true
  systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service || true
fi

# 6. Configure Host Firewall (UFW)
echo "🛡️ [6/7] Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
# Optional: direct testing ports (can be disabled if behind Nginx)
ufw allow 3000/tcp comment 'Next.js Direct'
ufw allow 4000/tcp comment 'Express Direct'
ufw --force enable

# 7. Prepare Application Directory
echo "📁 [7/7] Preparing Application Workspace..."
mkdir -p /home/ubuntu/app
chown -R ubuntu:ubuntu /home/ubuntu/app
chmod 755 /home/ubuntu/app

echo "================================================================"
echo "✅ WorkPilot AWS EC2 Bootstrapping Complete: $(date -u)"
echo "Next step: Clone repository to /home/ubuntu/app and set up .env"
echo "================================================================"
