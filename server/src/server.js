import dotenv from "dotenv";

dotenv.config();

import employeeRoutes from "./routes/employeeRoutes.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import payrollRoutes from "./routes/payrollRoutes.js";

dotenv.config();

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/payroll", payrollRoutes);

// API welcome route
app.get("/", (req, res) => {
  res.json({
    message: "St Teresa Hospital HRMS API is running",
  });
});

// Database connection test
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.json({
      status: "success",
      message: "Backend connected to PostgreSQL",
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`St Teresa HRMS API running on port ${PORT}`);
});
