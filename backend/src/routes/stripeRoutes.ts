import express from 'express';
import StripeLib from 'stripe';
import type { Stripe } from 'stripe';
import { authenticate } from '../middleware/auth';
import {
  getUserById,
  updateStripeCustomer,
  updateSubscriptionTier,
  getUserByStripeCustomerId,
} from '../database/userRepository';
import { sendSubscriptionConfirmation, sendSubscriptionCancellation } from '../services/emailService';

const router = express.Router();

const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('WARNING: STRIPE_SECRET_KEY not set - payment routes will fail');
}

// Price ID map - set these in your .env
const PRICE_IDS: Record<string, string> = {
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '',
  professional_yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || '',
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
  enterprise_yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
};

// Warn about missing price IDs
const missingPriceIds = Object.entries(PRICE_IDS).filter(([, v]) => !v).map(([k]) => k);
if (missingPriceIds.length > 0) {
  console.warn(`WARNING: Missing Stripe price IDs: ${missingPriceIds.join(', ')}`);
}

// Create checkout session
router.post('/create-checkout-session', authenticate, async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = (req as any).user.userId;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await updateStripeCustomer(userId, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      client_reference_id: userId,
      metadata: { userId },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer portal session
router.post('/create-portal-session', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await getUserById(userId);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscription status
router.get('/subscription-status', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeSubscriptionId) {
      return res.json({ tier: 'free', status: 'active', apiCallsRemaining: 1000, apiCallsLimit: 1000 });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    res.json({
      tier: user.subscriptionTier || 'free',
      status: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const user = await getUserById(userId);
    if (!user?.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const updatedSubscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    await sendSubscriptionCancellation(user.email);

    res.json({
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAt: new Date((updatedSubscription as any).cancel_at * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook - raw body already parsed by server.ts middleware
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature header');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook not configured');
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId || session.client_reference_id;
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;
          const tier = getTierFromPriceId(priceId);
          await updateSubscriptionTier(userId, tier, session.subscription as string);
          const user = await getUserById(userId);
          if (user) await sendSubscriptionConfirmation(user.email, tier);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const user = await getUserByStripeCustomerId(subscription.customer as string);
        if (user) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = getTierFromPriceId(priceId);
          await updateSubscriptionTier(user.id, tier, subscription.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const user = await getUserByStripeCustomerId(subscription.customer as string);
        if (user) {
          await updateSubscriptionTier(user.id, 'free', '');
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

function getTierFromPriceId(priceId: string): 'free' | 'professional' | 'enterprise' {
  if (priceId === PRICE_IDS.enterprise_monthly || priceId === PRICE_IDS.enterprise_yearly) {
    return 'enterprise';
  }
  if (priceId === PRICE_IDS.professional_monthly || priceId === PRICE_IDS.professional_yearly) {
    return 'professional';
  }
  return 'free';
}

export default router;
