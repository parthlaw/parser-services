import { ChargebeeItemPrice, PurchaseType } from '@/resources/chargebee/types';
import {
  generateHostedCheckout,
  generateHostedCheckoutOneTime,
  generateHostedExistingCheckout,
  getHostedCheckout,
} from '@/resources/chargebee/operations';
import { User } from '@supabase/supabase-js';
import { IUserGatewayIdRepository } from '@/repositories/user-gateway-id.repository';
// import { IBundleRepository } from "@/repositories/bundle.repository";
import { ISubscriptionRepository } from '@/repositories/subscription.repository';
import { IPageCreditRepository } from '@/repositories/page-credit.repository';
import { IBundle, IPageCredit, ISubscription } from '@/types/models';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseUserGatewayIdRepository } from '@/repositories/supabase.user-gateway-id.repository';
// import { SupabaseBundleRepository } from "@/repositories/supabase.bundle.repository";
import { SupabaseSubscriptionRepository } from '@/repositories/supabase.subscription.repository';
import { SupabasePageCreditRepository } from '@/repositories/supabase.page-credit.repository';
import itemPriceMapping from '@/lib/item-price-mapping.json';
// import { BadRequestError } from "@/utils/errors";
import { IBundleRepository } from '@/repositories/bundle.repository';
import { SupabaseBundleRepository } from '@/repositories/supabase.bundle.repository';
export class PaymentService {
  private user: User;
  private userGatewayIdRepository: IUserGatewayIdRepository;
  private bundleRepository: IBundleRepository;
  private subscriptionRepository: ISubscriptionRepository;
  private pageCreditRepository: IPageCreditRepository;
  constructor(user: User) {
    this.userGatewayIdRepository = new SupabaseUserGatewayIdRepository();
    this.bundleRepository = new SupabaseBundleRepository();
    this.subscriptionRepository = new SupabaseSubscriptionRepository();
    this.pageCreditRepository = new SupabasePageCreditRepository();
    this.user = user;
  }
  private async createUserGatewayId(gatewayUserId: string) {
    return await this.userGatewayIdRepository.createUserGatewayId({
      user_id: this.user.id,
      gateway_user_id: gatewayUserId,
    });
  }
  private async createBundle(bundle: IBundle) {
    return await this.bundleRepository.createBundle(bundle);
  }
  private async createSubscription(subscription: ISubscription) {
    return await this.subscriptionRepository.createSubscription(subscription);
  }
  private async createPageCredit(pageCredit: IPageCredit[]) {
    return await this.pageCreditRepository.createPageCredits(pageCredit);
  }
  private async getUserGatewayId(userId: string) {
    return await this.userGatewayIdRepository.getUserGatewayId(userId);
  }
  async getSubscription(userId: string, includeCredits: boolean = false) {
    const subscriptions = await this.subscriptionRepository.getSubscriptionsByUserId(userId);
    if (subscriptions.length > 0) {
      if (includeCredits) {
        const pageCredits = await this.pageCreditRepository.getRemainingPageCredits(userId);
        const totalPageCredits = pageCredits.reduce((acc, credit) => acc + credit.balance, 0);
        subscriptions[0].pageCredits = totalPageCredits || 0;
      }
      return subscriptions[0];
    }
    return null;
  }
  private async updateSubscription(subscription: ISubscription) {
    return await this.subscriptionRepository.updateSubscription(subscription);
  }
  async generateHostedCheckout(
    subscriptionItems: ChargebeeItemPrice[],
    purchaseType: PurchaseType
  ) {
    const firstName = this.user.user_metadata?.name?.split(' ')[0];
    const lastName = this.user.user_metadata?.name?.split(' ')[1];
    const userGatewayId = await this.getUserGatewayId(this.user.id);
    if (purchaseType === PurchaseType.SUBSCRIPTION) {
      const existingSubscription = await this.getSubscription(this.user.id);
      if (existingSubscription) {
        return await generateHostedExistingCheckout(
          existingSubscription.subscription_id as string,
          subscriptionItems
        );
      }
      return await generateHostedCheckout(subscriptionItems, {
        email: this.user.email || '',
        first_name: firstName || '',
        last_name: lastName || '',
        phone: this.user.user_metadata.phone || '',
        cf_user_id: this.user.id,
        ...(userGatewayId && { id: userGatewayId.gateway_user_id }),
      });
    } else {
      subscriptionItems.forEach((item) => {
        item.quantity = 1;
      });
      return await generateHostedCheckoutOneTime(subscriptionItems, {
        email: this.user.email || '',
        first_name: firstName || '',
        last_name: lastName || '',
        phone: this.user.user_metadata.phone || '',
        cf_user_id: this.user.id,
        ...(userGatewayId && { id: userGatewayId.gateway_user_id }),
      });
    }
  }
  private calculateSubscriptionEndDate(startTimestamp: number): string {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    return new Date(new Date(startTimestamp * 1000).getTime() + THIRTY_DAYS_MS).toISOString();
  }

  private async handleUserGatewayId(customerId: string): Promise<void> {
    const userGatewayId = await this.getUserGatewayId(this.user.id);
    if (!userGatewayId) {
      await this.createUserGatewayId(customerId);
    }
  }

  private createPageCreditEntry(
    change: number,
    reason: 'UPGRADE' | 'PURCHASE',
    sourceType: 'SUBSCRIPTION' | 'BUNDLE',
    referenceId: string,
    expiresAt: string | null
  ): IPageCredit {
    return {
      change,
      reason,
      source_type: sourceType,
      reference_id: referenceId,
      expires_at: expiresAt,
      id: uuidv4(),
      user_id: this.user.id,
      created_at: new Date().toISOString(),
    };
  }

  private async handleSubscriptionUpgrade(
    existingSubscription: any,
    subscription: any,
    pageCredits: IPageCredit[]
  ): Promise<void> {
    const existingPages =
      itemPriceMapping[existingSubscription.item_price_id as keyof typeof itemPriceMapping]?.pages;
    const newPages =
      itemPriceMapping[
        subscription.subscription_items?.[0]?.item_price_id as keyof typeof itemPriceMapping
      ]?.pages;
    const pageCreditDifference = newPages - existingPages;
    const endDate = this.calculateSubscriptionEndDate(subscription.started_at as number);

    await this.updateSubscription({
      id: existingSubscription.id,
      status: subscription.status as string,
      start_date: new Date(subscription.started_at as number).toISOString(),
      end_date: endDate,
      subscription_id: subscription.id as string,
      item_price_id: subscription.subscription_items?.[0]?.item_price_id as string,
      currency: subscription.currency_code as string,
      user_id: this.user.id,
    });

    pageCredits.push(
      this.createPageCreditEntry(
        pageCreditDifference,
        'UPGRADE',
        'SUBSCRIPTION',
        existingSubscription.id,
        endDate
      )
    );
  }

  private async handleNewSubscription(
    subscription: any,
    dbSubscriptionId: string,
    pageCredits: IPageCredit[]
  ): Promise<void> {
    const endDate = this.calculateSubscriptionEndDate(subscription.started_at as number);

    await this.createSubscription({
      id: dbSubscriptionId,
      user_id: this.user.id,
      currency: subscription.currency_code as string,
      start_date: new Date(subscription.started_at as number).toISOString(),
      end_date: endDate,
      subscription_id: subscription.id as string,
      item_price_id: subscription.subscription_items?.[0]?.item_price_id as string,
      status: subscription.status as string,
    });

    const subscriptionItems = subscription.subscription_items || [];
    subscriptionItems.forEach((item: { item_price_id: string }) => {
      const pages =
        itemPriceMapping[item.item_price_id as keyof typeof itemPriceMapping]?.pages || 0;
      pageCredits.push(
        this.createPageCreditEntry(pages, 'PURCHASE', 'SUBSCRIPTION', dbSubscriptionId, endDate)
      );
    });
  }

  private async handleSubscriptionFlow(
    subscription: any,
    pageCredits: IPageCredit[]
  ): Promise<void> {
    const dbSubscriptionId = uuidv4();
    const existingSubscription = await this.getSubscription(this.user.id);

    if (existingSubscription) {
      await this.handleSubscriptionUpgrade(existingSubscription, subscription, pageCredits);
    } else {
      await this.handleNewSubscription(subscription, dbSubscriptionId, pageCredits);
    }
  }

  private async handleBundlePurchase(
    invoice: any,
    dbBundleId: string,
    pageCredits: IPageCredit[]
  ): Promise<void> {
    const invoiceLineItems = invoice?.line_items || [];
    const invoiceId = invoice?.id || '';
    const currencyCode = invoice?.currency_code || '';

    for await (const item of invoiceLineItems) {
      const id = item.id;
      const bundleType = item.entity_id || '';
      const pages = itemPriceMapping[item.entity_id as keyof typeof itemPriceMapping]?.pages || 0;

      await this.createBundle({
        id: dbBundleId,
        user_id: this.user.id,
        bundle_type: bundleType,
        pages: pages,
        price: item.amount || 0,
        currency: currencyCode,
        purchased_at: new Date().toISOString(),
        valid_until: null,
        invoice_id: invoiceId || null,
        invoice_line_item_id: id || null,
      });

      pageCredits.push(this.createPageCreditEntry(pages, 'PURCHASE', 'BUNDLE', dbBundleId, null));
    }
  }

  async successCallbackHandler(hostedCheckoutId: string) {
    const hostedCheckout = await getHostedCheckout(hostedCheckoutId);
    const customer = hostedCheckout?.content?.customer;
    const subscription = hostedCheckout?.content?.subscription;
    const type = hostedCheckout.type;
    const pageCredits: IPageCredit[] = [];
    const dbBundleId = uuidv4();

    if (subscription) {
      await this.handleSubscriptionFlow(subscription, pageCredits);
    }

    if (type === 'checkout_one_time') {
      await this.handleBundlePurchase(hostedCheckout?.content?.invoice, dbBundleId, pageCredits);
    }

    await this.handleUserGatewayId(customer.id);
    await this.createPageCredit(pageCredits);

    return {
      success: true,
      message: 'Payment successful',
    };
  }
}
