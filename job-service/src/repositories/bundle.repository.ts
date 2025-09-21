import { IBundle, ICreateBundleInput, IUpdateBundleInput } from '@/types/models';

export interface IBundleRepository {
  createBundle(input: ICreateBundleInput): Promise<IBundle>;
  getBundle(id: string, userId: string): Promise<IBundle | null>;
  getBundlesByUserId(userId: string): Promise<IBundle[]>;
  getBundlesByType(bundleType: string): Promise<IBundle[]>;
  updateBundle(input: IUpdateBundleInput): Promise<IBundle>;
  deleteBundle(id: string, userId: string): Promise<void>;
}
