import { IPageCreditRepository } from "@/repositories/page-credit.repository";
import { SupabasePageCreditRepository } from "@/repositories/supabase.page-credit.repository";
import { IPageCredit, IPageCreditBalance } from "@/types/models";
import { User } from "@supabase/supabase-js";

class CreditsService {
    private readonly user: User;
    private readonly pageCreditRepository: IPageCreditRepository;
    constructor(user: User) {
        this.user = user;
        this.pageCreditRepository = new SupabasePageCreditRepository();
    }

    async getPageCreditsTotal(): Promise<number> {
        const pageCredits = await this.pageCreditRepository.getRemainingPageCredits(this.user.id);
        return pageCredits.reduce((acc, credit) => acc + credit.balance, 0);
    }
    async getPageCredits(): Promise<IPageCreditBalance[]> {
        return await this.pageCreditRepository.getRemainingPageCredits(this.user.id);
    }
    async grantMonthlyFreeCredits(): Promise<IPageCredit[]> {
        return await this.pageCreditRepository.grantMonthlyFreeCredits(this.user.id);
    }
    async getPageCreditsCountByJobId(jobId: string): Promise<number> {
        return await this.pageCreditRepository.getPageCreditsCountByJobId(jobId);
    }
    async getPageCreditByReferenceId(referenceId: string): Promise<IPageCredit | null> {
        return await this.pageCreditRepository.getPageCreditByReferenceId(referenceId);
    }
    // async addSubscriptionCredits(subscriptionItems: any[], ): Promise<IPageCredit[]> {
    //     const pageCredits: IPageCredit[] = [];
    //     subscriptionItems.forEach((item) => {
    //         pageCredits.push({
    //             id: (),
    //             user_id: this.user.id,
    //             change: item.pages,
    //             reason: 'SUBSCRIPTION',
    //             source_type: 'SUBSCRIPTION',
    //             reference_id: item.id,

    //         })
    //     })
    // }
}