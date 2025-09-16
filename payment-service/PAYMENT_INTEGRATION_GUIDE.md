# Multi-Provider Payment Integration Guide

This guide demonstrates how to use the new interface-based payment system that supports both PayPal and Razorpay providers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Setup](#environment-setup)
3. [Basic Usage](#basic-usage)
4. [Provider-Specific Features](#provider-specific-features)
5. [Advanced Usage](#advanced-usage)
6. [Webhook Integration](#webhook-integration)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## Architecture Overview

The payment system follows a clean architecture pattern with:

- **`IPaymentProvider`** - Common interface for all payment providers
- **`PayPalProvider`** - PayPal implementation
- **`RazorpayProvider`** - Razorpay implementation
- **`PaymentProviderFactory`** - Factory for creating provider instances
- **`PaymentService`** - High-level service with smart provider selection

```
PaymentService
    ↓
PaymentProviderFactory
    ↓
IPaymentProvider (Interface)
    ↓
PayPalProvider | RazorpayProvider
```

## Environment Setup

Add the following environment variables to your `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  # Use https://api-m.paypal.com for production
PAYPAL_WEBHOOK_ID=your_webhook_id

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_BASE_URL=https://api.razorpay.com
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Default provider (optional)
DEFAULT_PAYMENT_PROVIDER=paypal  # or razorpay
```

## Basic Usage

### 1. Simple Payment Service Usage

```typescript
import PaymentService from '@/services/payment.service';

// Auto-select provider based on currency
const paymentService = new PaymentService(undefined, 'INR'); // Will use Razorpay
// const paymentService = new PaymentService(undefined, 'USD'); // Will use PayPal

// Create a payment
const order = await paymentService.createPayment('100.00', 'INR');
console.log('Payment created:', order.id);

// Capture payment after user approval
const capture = await paymentService.capturePayment(order.id);
console.log('Payment captured:', capture.id);
```

### 2. Explicit Provider Selection

```typescript
import PaymentService from '@/services/payment.service';

// Use specific provider
const paypalService = new PaymentService('paypal');
const razorpayService = new PaymentService('razorpay');

// Create orders with different providers
const paypalOrder = await paypalService.createPayment('25.99', 'USD');
const razorpayOrder = await razorpayService.createPayment('1999.00', 'INR');
```

### 3. Subscription Management

```typescript
// Create monthly subscription
const subscription = await paymentService.createMonthlySubscription(
  'Premium Plan',           // product name
  'Monthly Premium',        // plan name
  '9.99',                  // price
  'customer@example.com',  // customer email
  'John Doe',              // customer name
  'USD'                    // currency
);

// Cancel subscription
await paymentService.cancelSubscription(subscription.subscription.id!);
```

## Provider-Specific Features

### PayPal-Specific Usage

```typescript
import { PayPalProvider } from '@/resources/paypal-provider';
import config from '@/config/environment';

const paypal = new PayPalProvider({
  clientId: config.PAYPAL_CLIENT_ID,
  clientSecret: config.PAYPAL_CLIENT_SECRET,
  baseUrl: config.PAYPAL_BASE_URL,
  webhookSecret: config.PAYPAL_WEBHOOK_ID,
  environment: 'sandbox'
});

// PayPal supports authorization before capture
const order = await paypal.createOrder({
  intent: 'AUTHORIZE', // Instead of CAPTURE
  amount: { currency_code: 'USD', value: '10.00' }
});

const authorization = await paypal.authorizeOrder(order.id);
// Later capture the authorized amount
const capture = await paypal.captureAuthorization(authorization.id, {
  amount: { currency_code: 'USD', value: '10.00' }
});
```

### Razorpay-Specific Usage

```typescript
import { RazorpayProvider } from '@/resources/razorpay-provider';
import config from '@/config/environment';

const razorpay = new RazorpayProvider({
  clientId: config.RAZORPAY_KEY_ID,
  clientSecret: config.RAZORPAY_KEY_SECRET,
  baseUrl: config.RAZORPAY_BASE_URL,
  webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
  environment: 'sandbox'
});

// Razorpay-specific methods
const customer = await razorpay.createCustomer({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+919999999999'
});

const payment = await razorpay.getPayment('pay_xyz123');
```

## Advanced Usage

### 1. Smart Provider Selection

```typescript
import { paymentProviderFactory } from '@/factories/payment-provider.factory';

// Select by currency
const provider = paymentProviderFactory.getProviderByCurrency('INR'); // Returns Razorpay
const order = await provider.createSimpleOrder('1000.00', 'INR');

// Select by region
const regionalProvider = paymentProviderFactory.getProviderByRegion('IN'); // Returns Razorpay
const usProvider = paymentProviderFactory.getProviderByRegion('US'); // Returns PayPal
```

### 2. Multi-Provider Handling

```typescript
import { paymentProviderFactory } from '@/factories/payment-provider.factory';

const providers = paymentProviderFactory.getAllProviders();

// Create orders with all providers
const orders = await Promise.allSettled([
  providers.paypal.createSimpleOrder('25.99', 'USD'),
  providers.razorpay.createSimpleOrder('1999.00', 'INR')
]);

orders.forEach((result, index) => {
  const providerName = index === 0 ? 'PayPal' : 'Razorpay';
  if (result.status === 'fulfilled') {
    console.log(`${providerName} order created:`, result.value.id);
  } else {
    console.error(`${providerName} failed:`, result.reason);
  }
});
```

### 3. Dynamic Provider Switching

```typescript
const paymentService = new PaymentService('paypal');
console.log('Current provider:', paymentService.getProviderName()); // PayPalProvider

// Switch to Razorpay for Indian customers
paymentService.switchProvider('razorpay');
console.log('Switched to:', paymentService.getProviderName()); // RazorpayProvider
```

## Webhook Integration

### 1. Unified Webhook Handler

```typescript
import { Request, Response } from 'express';
import PaymentService from '@/services/payment.service';

export async function handleWebhook(req: Request, res: Response) {
  try {
    // Determine provider from request (you can use different endpoints or headers)
    const provider = req.headers['x-payment-provider'] || 'paypal';
    const paymentService = new PaymentService(provider as 'paypal' | 'razorpay');

    // Verify webhook signature
    const verification = await paymentService.verifyWebhook(
      req.headers as Record<string, string>,
      JSON.stringify(req.body)
    );

    if (!verification.verified) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook event
    await paymentService.processWebhook(req.body);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
```

### 2. Provider-Specific Webhook Endpoints

```typescript
// routes/webhooks.ts
import { Router } from 'express';
import PaymentService from '@/services/payment.service';

const router = Router();

router.post('/paypal', async (req, res) => {
  const paymentService = new PaymentService('paypal');
  // Handle PayPal webhook
  const verification = await paymentService.verifyWebhook(req.headers, JSON.stringify(req.body));
  if (verification.verified) {
    await paymentService.processWebhook(req.body);
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid signature' });
  }
});

router.post('/razorpay', async (req, res) => {
  const paymentService = new PaymentService('razorpay');
  // Handle Razorpay webhook
  const verification = await paymentService.verifyWebhook(req.headers, JSON.stringify(req.body));
  if (verification.verified) {
    await paymentService.processWebhook(req.body);
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid signature' });
  }
});

export default router;
```

## Error Handling

### 1. Provider-Specific Error Handling

```typescript
import PaymentService from '@/services/payment.service';

async function createPaymentWithFallback(amount: string, currency: string) {
  const primaryService = new PaymentService(undefined, currency);
  
  try {
    return await primaryService.createPayment(amount, currency);
  } catch (error) {
    console.error('Primary provider failed:', error);
    
    // Fallback to alternative provider
    const fallbackProvider = currency === 'INR' ? 'paypal' : 'razorpay';
    const fallbackService = new PaymentService(fallbackProvider);
    
    try {
      return await fallbackService.createPayment(amount, currency);
    } catch (fallbackError) {
      console.error('Fallback provider also failed:', fallbackError);
      throw new Error('All payment providers failed');
    }
  }
}
```

### 2. Graceful Degradation

```typescript
async function createPaymentWithGracefulDegradation(amount: string, currency: string) {
  const providers: Array<'paypal' | 'razorpay'> = currency === 'INR' 
    ? ['razorpay', 'paypal'] 
    : ['paypal', 'razorpay'];

  for (const providerType of providers) {
    try {
      const service = new PaymentService(providerType);
      const order = await service.createPayment(amount, currency);
      
      return {
        success: true,
        order,
        provider: providerType
      };
    } catch (error) {
      console.warn(`${providerType} failed:`, error);
      continue;
    }
  }

  throw new Error('All payment providers failed');
}
```

## Best Practices

### 1. Provider Selection Strategy

```typescript
class SmartPaymentService {
  static getOptimalProvider(currency: string, region: string, amount: number): 'paypal' | 'razorpay' {
    // Business logic for provider selection
    if (region === 'IN' || currency === 'INR') {
      return 'razorpay';
    }
    
    if (amount < 1) { // Micro-payments
      return 'razorpay'; // Better for small amounts
    }
    
    return 'paypal'; // Default for international
  }

  static async createOptimalPayment(
    amount: string,
    currency: string,
    region: string,
    customerEmail: string
  ) {
    const providerType = this.getOptimalProvider(currency, region, parseFloat(amount));
    const service = new PaymentService(providerType);
    
    return await service.createPayment(amount, currency, undefined, undefined, customerEmail);
  }
}
```

### 2. Configuration Management

```typescript
// config/payment-providers.ts
export const PaymentConfig = {
  paypal: {
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    regions: ['US', 'EU', 'UK', 'CA', 'AU'],
    features: ['subscriptions', 'refunds', 'authorization', 'webhooks']
  },
  razorpay: {
    supportedCurrencies: ['INR'],
    regions: ['IN'],
    features: ['subscriptions', 'refunds', 'webhooks', 'upi', 'netbanking']
  }
};

export function getProviderForCurrency(currency: string): 'paypal' | 'razorpay' {
  if (PaymentConfig.razorpay.supportedCurrencies.includes(currency)) {
    return 'razorpay';
  }
  return 'paypal';
}
```

### 3. Testing Strategy

```typescript
// tests/payment.test.ts
import PaymentService from '@/services/payment.service';

describe('Payment Service', () => {
  describe('Provider Selection', () => {
    test('should use Razorpay for INR', () => {
      const service = new PaymentService(undefined, 'INR');
      expect(service.getProviderName()).toBe('RazorpayProvider');
    });

    test('should use PayPal for USD', () => {
      const service = new PaymentService(undefined, 'USD');
      expect(service.getProviderName()).toBe('PayPalProvider');
    });
  });

  describe('Payment Creation', () => {
    test('should create PayPal payment', async () => {
      const service = new PaymentService('paypal');
      const order = await service.createPayment('10.00', 'USD');
      
      expect(order.id).toBeDefined();
      expect(order.amount.currency_code).toBe('USD');
      expect(order.amount.value).toBe('10.00');
    });

    test('should create Razorpay payment', async () => {
      const service = new PaymentService('razorpay');
      const order = await service.createPayment('1000.00', 'INR');
      
      expect(order.id).toBeDefined();
      expect(order.amount.currency_code).toBe('INR');
      expect(order.amount.value).toBe('1000.00');
    });
  });
});
```

This architecture provides a flexible, maintainable, and extensible payment system that can easily accommodate additional payment providers in the future!
