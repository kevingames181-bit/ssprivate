import sgMail from '@sendgrid/mail';

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@seascope.us';
const APP_URL = process.env.FRONTEND_URL || 'https://seascope.us';

function init() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) {
    sgMail.setApiKey(apiKey);
  } else {
    console.warn('SENDGRID_API_KEY not set - emails will be logged to console only');
  }
}

init();

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }
  await sgMail.send({ to, from: FROM_EMAIL, subject, html });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await send(
    email,
    'Welcome to SeaScope Alaska',
    `<h1>Welcome, ${name}!</h1>
     <p>Your SeaScope Alaska account has been created successfully.</p>
     <p>You now have access to real-time Alaska fishery intelligence data.</p>
     <p><a href="${APP_URL}/map">Start exploring the map</a></p>`
  );
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  await send(
    email,
    'Reset your SeaScope password',
    `<h1>Password Reset Request</h1>
     <p>Click the link below to reset your password. This link expires in 1 hour.</p>
     <p><a href="${resetUrl}">Reset Password</a></p>
     <p>If you didn't request this, ignore this email.</p>`
  );
}

export async function sendEmailVerification(email: string, verificationToken: string): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
  await send(
    email,
    'Verify your SeaScope email',
    `<h1>Verify Your Email</h1>
     <p>Click the link below to verify your email address.</p>
     <p><a href="${verifyUrl}">Verify Email</a></p>`
  );
}

export async function sendSubscriptionConfirmation(email: string, tier: string): Promise<void> {
  await send(
    email,
    `SeaScope ${tier} subscription confirmed`,
    `<h1>Subscription Confirmed</h1>
     <p>Your <strong>${tier}</strong> subscription is now active.</p>
     <p><a href="${APP_URL}/dashboard">Go to your dashboard</a></p>`
  );
}

export async function sendSubscriptionCancellation(email: string): Promise<void> {
  await send(
    email,
    'SeaScope subscription cancellation',
    `<h1>Subscription Cancelled</h1>
     <p>Your subscription has been cancelled and will end at the current billing period.</p>
     <p><a href="${APP_URL}/pricing">Resubscribe anytime</a></p>`
  );
}
