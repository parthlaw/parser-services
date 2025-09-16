import { Router } from "express";
import { getJobs, getJob, createJob, getResults } from "@/controllers/jobs.controller";

const router = Router();

router.get("/", getJobs);
router.get("/:id", getJob);
router.post("/", createJob);
router.get("/:id/results", getResults);


export default router;