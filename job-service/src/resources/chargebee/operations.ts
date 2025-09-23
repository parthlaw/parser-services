import { getChargebeeClient } from './client';
import logger from '../../utils/logger';
import {
  ChargebeeCustomer,
  ChargebeeSubscription,
  ChargebeeCustomerCreateDto,
  ChargebeeItemPrice,
} from './types';
import { HostedPage } from 'chargebee';

export const getCustomer = async (customerId: string): Promise<ChargebeeCustomer> => {
  const chargebee = getChargebeeClient();

  try {
    const result = await chargebee.customer.retrieve(customerId);
    return result.customer as ChargebeeCustomer;
  } catch (error) {
    logger.error('Failed to retrieve customer', { error, customerId });
    throw error;
  }
};

export const getSubscription = async (subscriptionId: string): Promise<ChargebeeSubscription> => {
  const chargebee = getChargebeeClient();

  try {
    const result = await chargebee.subscription.retrieve(subscriptionId);
    return result.subscription as ChargebeeSubscription;
  } catch (error) {
    logger.error('Failed to retrieve subscription', { error, subscriptionId });
    throw error;
  }
};

export const generateHostedCheckout = async (
  subscriptionItems: ChargebeeItemPrice[],
  customer: ChargebeeCustomerCreateDto
) => {
  try {
    if (!customer.first_name || !customer.last_name || !customer.email) {
      throw new Error('Customer details are required');
    }
    const chargebee = getChargebeeClient();
    const result = await chargebee.hostedPage.checkoutNewForItems({
      subscription_items: subscriptionItems,
      customer: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        company: customer.company || '',
        ...(customer.cf_user_id && { cf_user_id: customer.cf_user_id }),
      } as any,
    });
    return result.hosted_page;
  } catch (error) {
    logger.error('Failed to generate hosted checkout', { error });
    throw error;
  }
};
export const generateHostedCheckoutOneTime = async (
  chargeItems: ChargebeeItemPrice[],
  customer: ChargebeeCustomerCreateDto
) => {
  const chargebee = getChargebeeClient();
  const result = await chargebee.hostedPage.checkoutOneTimeForItems({
    item_prices: chargeItems,
    currency_code: 'INR',
    customer: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company || '',
      ...(customer.cf_user_id && { cf_user_id: customer.cf_user_id }),
    } as any,
  });
  return result.hosted_page;
};
export const generateHostedExistingCheckout = async (
  subscriptionId: string,
  subscriptionItems: ChargebeeItemPrice[]
) => {
  const chargebee = getChargebeeClient();
  const result = await chargebee.hostedPage.checkoutExistingForItems({
    subscription: {
      id: subscriptionId,
    },
    subscription_items: subscriptionItems,
  });
  return result.hosted_page;
};
export const getHostedCheckout = async (hostedCheckoutId: string): Promise<HostedPage> => {
  const chargebee = getChargebeeClient();
  const result = await chargebee.hostedPage.retrieve(hostedCheckoutId);
  return result.hosted_page;
};
