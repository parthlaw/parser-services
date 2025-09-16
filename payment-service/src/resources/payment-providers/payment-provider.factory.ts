import config from "@/config/environment";
import {
  IPaymentProvider,
  IPaymentProviderFactory,
  PaymentProviderConfig,
} from "@/resources/payment-providers/payment-provider.interface";
import { PayPalProvider } from "@/resources/payment-providers/paypal-provider";
import { RazorpayProvider } from "@/resources/payment-providers/razorpay-provider";
import logger from "@/utils/logger";

export class PaymentProviderFactory implements IPaymentProviderFactory {
  /**
   * Create a payment provider instance
   */
  createProvider(type: 'paypal' | 'razorpay', providerConfig?: PaymentProviderConfig): IPaymentProvider {
    logger.info(`Creating payment provider: ${type}`);

    switch (type) {
      case 'paypal':
        return new PayPalProvider(providerConfig || {
          clientId: config.PAYPAL_CLIENT_ID,
          clientSecret: config.PAYPAL_CLIENT_SECRET,
          baseUrl: config.PAYPAL_BASE_URL,
          webhookSecret: config.PAYPAL_WEBHOOK_ID,
          environment: config.STAGE === 'prod' ? 'production' : 'sandbox',
        });

      case 'razorpay':
        return new RazorpayProvider(providerConfig || {
          clientId: config.RAZORPAY_KEY_ID,
          clientSecret: config.RAZORPAY_KEY_SECRET,
          baseUrl: config.RAZORPAY_BASE_URL,
          webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
          environment: config.STAGE === 'prod' ? 'production' : 'sandbox',
        });

      default:
        throw new Error(`Unsupported payment provider: ${type}`);
    }
  }

  /**
   * Get default payment provider based on environment configuration
   */
  getDefaultProvider(): IPaymentProvider {
    // You can implement logic to choose default provider based on:
    // - Environment variables
    // - Geographic location
    // - Business requirements
    
    const defaultProvider = process.env.DEFAULT_PAYMENT_PROVIDER || 'paypal';
    
    if (defaultProvider === 'razorpay') {
      return this.createProvider('razorpay');
    }
    
    return this.createProvider('paypal');
  }

  /**
   * Get all available providers
   */
  getAllProviders(): Record<string, IPaymentProvider> {
    return {
      paypal: this.createProvider('paypal'),
      razorpay: this.createProvider('razorpay'),
    };
  }

  /**
   * Get provider based on currency (helper method)
   */
  getProviderByCurrency(currency: string): IPaymentProvider {
    // Simple logic: use Razorpay for INR, PayPal for others
    // You can extend this logic based on your business needs
    
    if (currency === 'INR') {
      return this.createProvider('razorpay');
    }
    
    return this.createProvider('paypal');
  }

  /**
   * Get provider based on region (helper method)
   */
  getProviderByRegion(region: string): IPaymentProvider {
    // Simple logic: use Razorpay for India, PayPal for others
    // You can extend this logic based on your business needs
    
    const indianRegions = ['IN', 'IND', 'INDIA'];
    
    if (indianRegions.includes(region.toUpperCase())) {
      return this.createProvider('razorpay');
    }
    
    return this.createProvider('paypal');
  }
}

// Export singleton instance
export const paymentProviderFactory = new PaymentProviderFactory();
