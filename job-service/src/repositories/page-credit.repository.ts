import {
  IPageCredit,
  ICreatePageCreditInput,
  IPageCreditBalance,
} from '@/types/models';

export interface IPageCreditRepository {
  createPageCredit(input: ICreatePageCreditInput): Promise<IPageCredit>;
  createPageCredits(input: ICreatePageCreditInput[]): Promise<IPageCredit[]>;
  getRemainingPageCredits(userId: string): Promise<IPageCreditBalance[]>;
  getPageCreditsCountByJobId(jobId: string): Promise<number>;
  getPageCreditByReferenceId(referenceId: string): Promise<IPageCredit | null>;
}
