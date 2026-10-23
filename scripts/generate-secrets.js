const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const generateHighEntropySecret = () => crypto.randomBytes(32).toString('hex');

const envProductionPath = path.join(__dirname, '..', '.env.production');
const envProductionNewPath = path.join(__dirname, '..', '.env.production.new');

let content = '';

if (fs.existsSync(envProductionPath)) {
  content = fs.readFileSync(envProductionPath, 'utf8');
} else {
  content = fs.readFileSync(path.join(__dirname, '..', '.env.production.example'), 'utf8');
}

// Generate new secrets
const jwtSecret = generateHighEntropySecret();
const dataEncryptionKey = generateHighEntropySecret();
const unipileWebhookSecret = generateHighEntropySecret();
const razorpayWebhookSecret = generateHighEntropySecret();

// Replace existing secrets or add them
const setOrReplace = (content, key, value) => {
  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content + `\n${key}=${value}`;
};

content = setOrReplace(content, 'JWT_SECRET', jwtSecret);
content = setOrReplace(content, 'DATA_ENCRYPTION_KEY', dataEncryptionKey);
content = setOrReplace(content, 'UNIPILE_WEBHOOK_SECRET', unipileWebhookSecret);
content = setOrReplace(content, 'RAZORPAY_WEBHOOK_SECRET', razorpayWebhookSecret);

fs.writeFileSync(envProductionNewPath, content);
console.log('Generated high-entropy secrets and saved to .env.production.new');
console.log('Please copy the contents to your production secret manager (or .env.production)');
console.log('Make sure to configure the remaining manual secrets:');
console.log('- RAZORPAY_KEY_ID');
console.log('- RAZORPAY_KEY_SECRET');
console.log('- RESEND_API_KEY');
console.log('- EMAIL_FROM');
console.log('- SUPPORT_EMAIL');
