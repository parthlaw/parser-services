import { ISubscription, ICreateSubscriptionInput, IUpdateSubscriptionInput } from '@/types/models';

export interface ISubscriptionRepository {
  createSubscription(input: ICreateSubscriptionInput): Promise<ISubscription>;
  getSubscription(id: string, userId: string): Promise<ISubscription | null>;
  getSubscriptionsByUserId(userId: string): Promise<ISubscription[]>;
  getActiveSubscriptions(userId: string): Promise<ISubscription[]>;
  updateSubscription(input: IUpdateSubscriptionInput): Promise<ISubscription>;
  deleteSubscription(id: string, userId: string): Promise<void>;
}
