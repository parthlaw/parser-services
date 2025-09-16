import { Request, Response } from "express";
import UserRepository from "@/repositories/user.repository";
import { IUser } from "@/types/models";
import { v4 as uuidv4 } from "uuid";
import ApiResponseHandler from "@/utils/apiResponseHandler";
export default class UserController {
  static async create(req: Request, res: Response) {
    try {
      const user: IUser = {
        User_ID: uuidv4(),
        Email: req.body.email,
        Password_Hash: req.body.passwordHash || "",
        Created_At: new Date().toISOString(),
        Updated_At: new Date().toISOString(),
      };

      console.log("user", user);
      await UserRepository.create(user);
      return ApiResponseHandler.created(res, user, "User created successfully");
    } catch (error) {
      return ApiResponseHandler.error(res, error);
    }
  }

  static async getAll(_req: Request, res: Response) {
    try {
      const users = await UserRepository.getAll();
      return ApiResponseHandler.success(res, users, "Fetched users");
    } catch (error) {
      return ApiResponseHandler.error(res, error);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const user = await UserRepository.getById(req.params.id);
      if (!user) return ApiResponseHandler.notFound(res, "User not found");
      return ApiResponseHandler.success(res, user, "Fetched user");
    } catch (error) {
      return ApiResponseHandler.error(res, error);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      await UserRepository.update(req.params.id, req.body);
      return ApiResponseHandler.success(res, null, "User updated");
    } catch (error) {
      return ApiResponseHandler.error(res, error);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await UserRepository.delete(req.params.id);
      return ApiResponseHandler.success(res, null, "User deleted");
    } catch (error) {
      return ApiResponseHandler.error(res, error);
    }
  }
}
