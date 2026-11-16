import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", authenticateToken, (req, res) => {
  res.json({
    status: "success",
    message: "Authenticated account retrieved.",
    user: req.user,
  });
});

export default router;
