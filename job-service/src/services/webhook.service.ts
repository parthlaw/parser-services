import { IUserGatewayIdRepository } from '@/repositories/user-gateway-id.repository';
import { SupabaseUserGatewayIdRepository } from '@/repositories/supabase.user-gateway-id.repository';
import { WebhookContentType, WebhookEvent } from 'chargebee';
import { ISubscriptionRepository } from '@/repositories/subscription.repository';
import { SupabaseSubscriptionRepository } from '@/repositories/supabase.subscription.repository';
import { v4 as uuidv4 } from 'uuid';
import { IPageCredit } from '@/types/models';
import { IPageCreditRepository } from '@/repositories/page-credit.repository';
import { SupabasePageCreditRepository } from '@/repositories/supabase.page-credit.repository';
import itemPriceMapping from '@/lib/item-price-mapping.json';
class WebhookService {
  private userGatewayIdRepository: IUserGatewayIdRepository;
  private subscriptionRepository: ISubscriptionRepository;
  private pageCreditRepository: IPageCreditRepository;
  constructor() {
    this.userGatewayIdRepository = new SupabaseUserGatewayIdRepository();
    this.subscriptionRepository = new SupabaseSubscriptionRepository();
    this.pageCreditRepository = new SupabasePageCreditRepository();
  }
  private async handleCustomerCreated(data: WebhookEvent<WebhookContentType.CustomerCreated>) {
    const customer = data.content.customer;
    // check if record already exists
    const userGatewayId = await this.userGatewayIdRepository.getUserGatewayIdsByGatewayUserId(
      customer.id
    );
    if (userGatewayId) {
      return;
    }
    const user_id = customer.cf_user_id as string;
    if (!user_id) {
      return;
    }
    // create record
    await this.userGatewayIdRepository.createUserGatewayId({
      user_id: user_id,
      gateway_user_id: customer.id,
    });
  }
  private async handlePageCreditsCreation(pageCreditData: IPageCredit, referenceId: string) {
    const existingPageCredit =
      await this.pageCreditRepository.getPageCreditByReferenceId(referenceId);
    if (existingPageCredit) {
      return;
    }
    await this.pageCreditRepository.createPageCredit(pageCreditData);
  }
  private async handleSubscriptionCreated(
    data: WebhookEvent<WebhookContentType.SubscriptionCreated>
  ) {
    const subscription = data.content.subscription;
    const userId = data.content.customer.cf_user_id as string;
    // check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.getSubscriptionByExternalId(
      subscription.id
    );
    const pageCreditData: IPageCredit = {
      id: uuidv4(),
      user_id: userId,
      change:
        itemPriceMapping[
          subscription.subscription_items?.[0]?.item_price_id as keyof typeof itemPriceMapping
        ]?.pages || 0,
      reason: 'PURCHASE',
      source_type: 'SUBSCRIPTION',
      reference_id: subscription.id,
      job_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date((subscription.current_term_end as number) * 1000).toISOString(),
    };
    await this.handlePageCreditsCreation(pageCreditData, subscription.id);
    if (existingSubscription) {
      return;
    }
    await this.subscriptionRepository.createSubscription({
      id: uuidv4(),
      user_id: userId,
      currency: subscription.currency_code as string,
      start_date: new Date((subscription.started_at as number) * 1000).toISOString(),
      end_date: new Date((subscription.current_term_end as number) * 1000).toISOString(),
      subscription_id: subscription.id,
      item_price_id: subscription.subscription_items?.[0]?.item_price_id as string,
      status: subscription.status as string,
    });
  }
  private async handleSubscriptionUpdated(
    data: WebhookEvent<WebhookContentType.SubscriptionChanged>
  ) {
    const subscription = data.content.subscription;
    const userId = data.content.customer.cf_user_id as string;
    // check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.getSubscriptionByExternalId(
      subscription.id
    );
    if (!existingSubscription) {
      return;
    }
    const existingPages =
      itemPriceMapping[existingSubscription.item_price_id as keyof typeof itemPriceMapping]?.pages;
    const newPages =
      itemPriceMapping[
        subscription.subscription_items?.[0]?.item_price_id as keyof typeof itemPriceMapping
      ]?.pages;
    const pageCreditDifference = newPages - existingPages;
    const endDate = new Date((subscription.current_term_end as number) * 1000).toISOString();

    await this.subscriptionRepository.updateSubscription({
      id: existingSubscription.id,
      status: subscription.status as string,
      start_date: new Date((subscription.current_term_start as number) * 1000).toISOString(),
      end_date: endDate,
      subscription_id: subscription.id as string,
      item_price_id: subscription.subscription_items?.[0]?.item_price_id as string,
      currency: subscription.currency_code as string,
    });
    const pageCredit: IPageCredit = {
      id: uuidv4(),
      user_id: userId,
      change: pageCreditDifference,
      reason: 'UPGRADE',
      source_type: 'SUBSCRIPTION',
      reference_id: subscription.id,
      job_id: null,
      created_at: new Date().toISOString(),
      expires_at: endDate,
    };
    await this.handlePageCreditsCreation(pageCredit, subscription.id);
  }
  private async handleSubscriptionCanceled(
    data: WebhookEvent<WebhookContentType.SubscriptionCancelled>
  ) {
    const subscription = data.content.subscription;
    // check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.getSubscriptionByExternalId(
      subscription.id
    );
    if (!existingSubscription) {
      return;
    }
    await this.subscriptionRepository.updateSubscription({
      id: existingSubscription.id,
      status: subscription.status as string,
    });
  }

  async handleChargebeeWebhookRequest(data: WebhookEvent) {
    switch (data.event_type) {
      case WebhookContentType.CustomerCreated:
        await this.handleCustomerCreated(data as WebhookEvent<WebhookContentType.CustomerCreated>);
        break;
      case WebhookContentType.SubscriptionCreated:
        await this.handleSubscriptionCreated(
          data as WebhookEvent<WebhookContentType.SubscriptionCreated>
        );
        break;
      case WebhookContentType.SubscriptionChanged:
        await this.handleSubscriptionUpdated(
          data as WebhookEvent<WebhookContentType.SubscriptionChanged>
        );
        break;
      case WebhookContentType.SubscriptionCancelled:
        await this.handleSubscriptionCanceled(
          data as WebhookEvent<WebhookContentType.SubscriptionCancelled>
        );
        break;
      default:
        break;
    }
  }
}
export default WebhookService;
