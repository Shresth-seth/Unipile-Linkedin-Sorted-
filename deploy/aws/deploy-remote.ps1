# ==============================================================================
# WorkPilot - Automated Remote Deployment to AWS EC2
# ==============================================================================
param(
    [string]$TargetIP = $env:EC2_TARGET_IP,
    [string]$KeyFile = $env:EC2_SSH_KEY_PATH,
    [string]$EnvFile = $env:PRODUCTION_ENV_FILE,
    [string]$RepoUrl = ($env:GIT_REPO_URL ? $env:GIT_REPO_URL : "https://github.com/YuvrajKhare2025/unipile-linkedin-automation.git")
)

if (-not $TargetIP) {
    Write-Host "[ERROR] Target IP is required. Provide -TargetIP or set EC2_TARGET_IP environment variable." -ForegroundColor Red
    exit 1
}

if (-not $KeyFile) {
    Write-Host "[ERROR] SSH KeyFile is required. Provide -KeyFile or set EC2_SSH_KEY_PATH environment variable." -ForegroundColor Red
    exit 1
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "[DEPLOY] Deploying WorkPilot to AWS EC2: $TargetIP" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# Check if SSH key exists
if (-not (Test-Path $KeyFile)) {
    Write-Host "[ERROR] SSH key not found at: $KeyFile" -ForegroundColor Red
    exit 1
}

# Fix Windows permissions on PEM key for OpenSSH
Write-Host "[KEY] Securing PEM key permissions..." -ForegroundColor Yellow
icacls "$KeyFile" /inheritance:r | Out-Null
icacls "$KeyFile" /grant:r "$($env:USERNAME):(R)" | Out-Null

# Test SSH connectivity
Write-Host "[CHECK] Testing SSH connectivity to $TargetIP on Port 22..." -ForegroundColor Yellow
$sshTest = Test-NetConnection -ComputerName $TargetIP -Port 22 -WarningAction SilentlyContinue

if (-not $sshTest.TcpTestSucceeded) {
    Write-Host ""
    Write-Host "[ACTION REQUIRED] AWS FIREWALL IS BLOCKING PORT 22 AND PORT 80!" -ForegroundColor Red
    Write-Host "The AWS Security Group on your EC2 instance has not allowed inbound traffic." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please do these 4 steps in the AWS Console (takes 30 seconds):" -ForegroundColor Green
    Write-Host "1. Open AWS Console -> EC2 -> Instances" -ForegroundColor White
    Write-Host "2. Click on your instance ($TargetIP)" -ForegroundColor White
    Write-Host "3. Click Security tab below -> Click your Security Group (e.g. launch-wizard-1)" -ForegroundColor White
    Write-Host "4. Click Edit inbound rules -> Add rule:" -ForegroundColor White
    Write-Host "   - Rule 1: Type SSH | Port 22 | Source Anywhere-IPv4 (0.0.0.0/0)" -ForegroundColor Cyan
    Write-Host "   - Rule 2: Type HTTP | Port 80 | Source Anywhere-IPv4 (0.0.0.0/0)" -ForegroundColor Cyan
    Write-Host "5. Click Save rules" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "[OK] Port 22 reachable! Proceeding with full automated setup on EC2..." -ForegroundColor Green

# Step 1: Clone or update repo on EC2 and run setup-ec2.sh
Write-Host "[STEP 1] Initializing EC2 instance packages, 4GB swap, and Docker..." -ForegroundColor Cyan
$remoteInit = "sudo mkdir -p /home/ubuntu/app && sudo chown -R ubuntu:ubuntu /home/ubuntu/app && if [ ! -d /home/ubuntu/app/.git ]; then git clone $RepoUrl /home/ubuntu/app; else cd /home/ubuntu/app && git fetch origin main && git reset --hard origin/main; fi && cd /home/ubuntu/app && sudo bash deploy/aws/setup-ec2.sh"

ssh -i "$KeyFile" -o StrictHostKeyChecking=no ubuntu@$TargetIP $remoteInit

# Step 2: Upload production .env (if specified)
if ($EnvFile -and (Test-Path $EnvFile)) {
    Write-Host "[STEP 2] Transferring production environment configuration (.env)..." -ForegroundColor Cyan
    scp -i "$KeyFile" -o StrictHostKeyChecking=no "$EnvFile" "ubuntu@${TargetIP}:/home/ubuntu/app/.env"
} else {
    Write-Host "[STEP 2] No local -EnvFile specified. Verifying /home/ubuntu/app/.env on remote instance..." -ForegroundColor Yellow
}

# Step 3: Run production deployment
Write-Host "[STEP 3] Launching WorkPilot Docker containers and Nginx reverse proxy..." -ForegroundColor Cyan
$remoteDeploy = "cd /home/ubuntu/app && bash scripts/deploy-production.sh"

ssh -i "$KeyFile" -o StrictHostKeyChecking=no ubuntu@$TargetIP $remoteDeploy

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Deployment Complete!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "Access WorkPilot at: http://$TargetIP/" -ForegroundColor White
Write-Host "Backend Health:     http://$TargetIP/api/health/liveness" -ForegroundColor White
Write-Host ""
