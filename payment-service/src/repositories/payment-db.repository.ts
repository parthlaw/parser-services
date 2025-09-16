import { PaymentRepository } from './payment.repository';
import { SupabasePaymentRepository } from './supabase-payment.repository';
import envConfig from '@/config/environment';
// Export the interface and implementation
export { PaymentRepository } from './payment.repository';
export { SupabasePaymentRepository } from './supabase-payment.repository';

// Factory function to create repository instances
export class PaymentRepositoryFactory {

    /**
     * Creates a payment repository instance
     * @param db - Database type
     * @param userToken - Optional JWT token for user context (enables RLS)
     * @returns PaymentRepository instance
     */
    static createPaymentRepository(db: string, userToken?: string): PaymentRepository {
        const supabaseUrl = envConfig.SUPABASE_URL;
        const supabaseKey = envConfig.SUPABASE_KEY;
        switch (db) {
            case 'supabase':
                if (!userToken) {
                    throw new Error('User token is required');
                }
                return new SupabasePaymentRepository(supabaseUrl, supabaseKey, userToken);
            default:
                if (!userToken) {
                    throw new Error('User token is required');
                }
                return new SupabasePaymentRepository(supabaseUrl, supabaseKey, userToken);
        }
    }
}

// Default export for convenience
export default PaymentRepositoryFactory;
