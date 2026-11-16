import dotenv from "dotenv";

dotenv.config();

import crypto from "crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import pool from "../config/db.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT
          u.id,
          u.full_name,
          u.email,
          u.password_hash,
          u.account_type,
          u.is_active,
          e.id AS employee_id,
          COALESCE(
            ARRAY_AGG(DISTINCT r.role_name)
              FILTER (WHERE r.role_name IS NOT NULL),
            ARRAY[]::VARCHAR[]
          ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       GROUP BY u.id, e.id`,
      [email.trim()],
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    if (!user.roles.length) {
      return res.status(403).json({
        status: "error",
        message: "No access role has been assigned to this account.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        accountType: user.account_type,
        roles: user.roles,
        employeeId: user.employee_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      },
    );

    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id],
    );

    return res.json({
      status: "success",
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        accountType: user.account_type,
        roles: user.roles,
        employeeId: user.employee_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred during login.",
    });
  }
});

// Limit repeated activation attempts
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many activation attempts. Please try again later.",
  },
});

// Activate an employee account and set its password
router.post("/activate-account", activationLimiter, async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      status: "error",
      message: "Activation token and password are required.",
    });
  }

  if (typeof password !== "string" || password.length < 12) {
    return res.status(400).json({
      status: "error",
      message: "Password must contain at least 12 characters.",
    });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the activation token while processing it
    const tokenResult = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM account_activation_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: "Invalid activation link.",
      });
    }

    const activation = tokenResult.rows[0];

    if (activation.used_at) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: "This activation link has already been used.",
      });
    }

    if (new Date(activation.expires_at) <= new Date()) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: "This activation link has expired. Request a new one.",
      });
    }

    // Confirm that the account belongs to an inactive employee
    const userResult = await client.query(
      `SELECT id, account_type, is_active
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [activation.user_id],
    );

    if (
      userResult.rows.length === 0 ||
      userResult.rows[0].account_type !== "EMPLOYEE"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: "Employee account could not be verified.",
      });
    }

    if (userResult.rows[0].is_active) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: "This employee account is already active.",
      });
    }

    // Hash the employee's new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Activate account and mark email as verified
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           is_active = TRUE,
           email_verified = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, activation.user_id],
    );

    // Mark this activation token as used
    await client.query(
      `UPDATE account_activation_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [activation.id],
    );

    // Revoke any other outstanding activation tokens
    await client.query(
      `DELETE FROM account_activation_tokens
       WHERE user_id = $1 AND id <> $2`,
      [activation.user_id, activation.id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      status: "success",
      message:
        "Your account has been activated successfully. You can now log in.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Account activation error:", error);

    return res.status(500).json({
      status: "error",
      message: "Account activation failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

export default router;
