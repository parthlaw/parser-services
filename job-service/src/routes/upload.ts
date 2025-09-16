import { getPdfUploadUrl } from "@/controllers/uploads.controller";
import { withJwtAuthNoAuth } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/errorHandler";
import { Router } from "express";
const router = Router();


router.get("/pdf", withJwtAuthNoAuth, asyncHandler(getPdfUploadUrl));

export default router;