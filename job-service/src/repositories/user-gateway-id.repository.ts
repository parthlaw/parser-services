import { IUserGatewayId, ICreateUserGatewayIdInput } from '@/types/models';

export interface IUserGatewayIdRepository {
  createUserGatewayId(input: ICreateUserGatewayIdInput): Promise<IUserGatewayId>;
  getUserGatewayId(userId: string): Promise<IUserGatewayId | null>;
  getUserGatewayIdsByUserId(userId: string): Promise<IUserGatewayId[]>;
  getUserGatewayIdsByGatewayUserId(gatewayUserId: string): Promise<IUserGatewayId | null>;
  deleteUserGatewayId(userId: string, gatewayUserId: string): Promise<void>;
}
