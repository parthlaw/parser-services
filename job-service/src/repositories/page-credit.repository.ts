import { IPageCredit, ICreatePageCreditInput, IUpdatePageCreditInput, IPageCreditBalance } from '@/types/models';

export interface IPageCreditRepository {
  createPageCredit(input: ICreatePageCreditInput): Promise<IPageCredit>;
  createPageCredits(input: ICreatePageCreditInput[]): Promise<IPageCredit[]>;
  getPageCredit(id: string, userId: string): Promise<IPageCredit | null>;
  getPageCreditsByUserId(userId: string): Promise<IPageCredit[]>;
  getPageCreditsByReason(reason: string): Promise<IPageCredit[]>;
  getPageCreditsBySourceType(sourceType: string): Promise<IPageCredit[]>;
  getPageCreditsByReferenceId(referenceId: string): Promise<IPageCredit[]>;
  updatePageCredit(input: IUpdatePageCreditInput): Promise<IPageCredit>;
  deletePageCredit(id: string, userId: string): Promise<void>;
  getRemainingPageCredits(userId: string): Promise<IPageCreditBalance[]>;
}
