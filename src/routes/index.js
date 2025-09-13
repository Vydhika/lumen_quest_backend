import express from "express";
import userRoutes from "./userRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";

const router = express.Router();

router.use("/user", userRoutes);
router.use("/analytics", analyticsRoutes);

export default router;

