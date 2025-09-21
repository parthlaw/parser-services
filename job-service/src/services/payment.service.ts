import { ChargebeeItemPrice, PurchaseType } from "@/resources/chargebee/types";
import { generateHostedCheckout, generateHostedCheckoutOneTime, getHostedCheckout } from "@/resources/chargebee/operations";
import { User } from "@supabase/supabase-js";
import { IUserGatewayIdRepository } from "@/repositories/user-gateway-id.repository";
// import { IBundleRepository } from "@/repositories/bundle.repository";
import { ISubscriptionRepository } from "@/repositories/subscription.repository";
import { IPageCreditRepository } from "@/repositories/page-credit.repository";
import { IPageCredit, ISubscription } from "@/types/models";
import { v4 as uuidv4 } from 'uuid';
import { SupabaseUserGatewayIdRepository } from "@/repositories/supabase.user-gateway-id.repository";
// import { SupabaseBundleRepository } from "@/repositories/supabase.bundle.repository";
import { SupabaseSubscriptionRepository } from "@/repositories/supabase.subscription.repository";
import { SupabasePageCreditRepository } from "@/repositories/supabase.page-credit.repository";
import itemPriceMapping from "@/lib/item-price-mapping.json";
import fs from 'fs';
import { BadRequestError } from "@/utils/errors";
export class PaymentService {
    private user: User;
    private userGatewayIdRepository: IUserGatewayIdRepository;
    // private bundleRepository: IBundleRepository;
    private subscriptionRepository: ISubscriptionRepository;
    private pageCreditRepository: IPageCreditRepository;
    constructor(user: User) {
        this.userGatewayIdRepository = new SupabaseUserGatewayIdRepository();
        // this.bundleRepository = new SupabaseBundleRepository();
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
    // private async createBundle(bundle: IBundle) {
    //     return await this.bundleRepository.createBundle(bundle);
    // }
    private async createSubscription(subscription: ISubscription) {
        return await this.subscriptionRepository.createSubscription(subscription);
    }
    private async createPageCredit(pageCredit: IPageCredit[]) {
        return await this.pageCreditRepository.createPageCredits(pageCredit);
    }
    private async getUserGatewayId(userId: string) {
        return await this.userGatewayIdRepository.getUserGatewayId(userId);
    }
    async getSubscription(userId: string) {
        const subscriptions = await this.subscriptionRepository.getSubscriptionsByUserId(userId);
        if (subscriptions.length > 0) {
            return subscriptions[0];
        }
        return null;
    }
    async generateHostedCheckout(subscriptionItems: ChargebeeItemPrice[], purchaseType: PurchaseType) {
        const firstName = this.user.user_metadata?.name?.split(' ')[0];
        const lastName = this.user.user_metadata?.name?.split(' ')[1];
        const userGatewayId = await this.getUserGatewayId(this.user.id);
        if (purchaseType === PurchaseType.SUBSCRIPTION) {
            const is_exists_subscription = await this.getSubscription(this.user.id);
            if (is_exists_subscription) {
                throw new BadRequestError('Subscription already exists');
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
            subscriptionItems.forEach(item => {
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
    async successCallbackHandler(hostedCheckoutId: string) {
        const hostedCheckout = await getHostedCheckout(hostedCheckoutId);
        const customer = hostedCheckout?.content?.customer;
        const subscription = hostedCheckout?.content?.subscription;
        // const bundle_id = hostedCheckout?.content?.non_subscription?.charge_id;
        const page_credits: IPageCredit[] = []
        const db_subscription_id = uuidv4();
        // const db_bundle_id = uuidv4();
        // add whole hostedcheckout to a temp.json file
        fs.writeFileSync('hostedCheckout.json', JSON.stringify(hostedCheckout, null, 2));
        if (subscription) {
            await this.createSubscription({
                id: db_subscription_id,
                user_id: this.user.id,
                currency: subscription.currency_code as string,
                start_date: new Date(subscription.started_at as number).toISOString(),
                end_date: new Date(new Date(subscription.started_at as number).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                subscription_id: subscription.id as string,
                item_price_id: subscription.subscription_items?.[0]?.item_price_id as string,
                status: subscription.status as string,
            });
            // Note: pages_per_period is no longer stored in subscription table
            // You may need to get this value from Chargebee subscription data or configuration
            // const pagesPerPeriod = subscription.pages_per_period as number || 0;
            const subscriptionItem = subscription.subscription_items || [];
            subscriptionItem.forEach(item => {
                page_credits.push({
                    change: itemPriceMapping[(item.item_price_id as keyof typeof itemPriceMapping)]?.pages || 0,
                    reason: 'PURCHASE',
                    source_type: 'SUBSCRIPTION',
                    reference_id: db_subscription_id,
                    expires_at: new Date(new Date(subscription.started_at as number).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    id: uuidv4(),
                    user_id: this.user.id,
                    created_at: new Date().toISOString(),
                });
            })
        }
        // if (bundle_id) {
        //     await this.createBundle({
        //         id: db_bundle_id,
        //         user_id: this.user.id,
        //         bundle_type: 'BUNDLE',
        //         pages: 0,
        //         price: 0,
        //         currency: 'USD',
        //         purchased_at: new Date().toISOString(),
        //         valid_until: null,
        //         charge_id: bundle_id,
        //     });
        //     page_credits.push({
        //         change: 0,
        //         reason: 'PURCHASE',
        //         source_type: 'BUNDLE',
        //         reference_id: db_bundle_id,
        //         expires_at: null,
        //         id: uuidv4(),
        //         user_id: this.user.id,
        //         created_at: new Date().toISOString(),
        //     });
        // }
        const userGatewayId = await this.getUserGatewayId(this.user.id);
        if (!userGatewayId) {
            await this.createUserGatewayId(customer.id);
        }
        await this.createPageCredit(page_credits);
        return {
            success: true,
            message: 'Payment successful',
        };
    }
}