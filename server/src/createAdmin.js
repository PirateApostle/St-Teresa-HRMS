import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pool from "./config/db.js";

dotenv.config();

async function createAdmin() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 12) {
    throw new Error(
      "Provide ADMIN_NAME, ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email],
    );

    if (existing.rows.length) {
      throw new Error("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users
        (full_name, email, password_hash, account_type)
       VALUES ($1, LOWER($2), $3, 'ADMIN')
       RETURNING id, full_name, email`,
      [name, email, passwordHash],
    );

    const adminRole = await client.query(
      "SELECT id FROM roles WHERE role_name = 'SUPER_ADMIN'",
    );

    if (!adminRole.rows.length) {
      throw new Error("SUPER_ADMIN role not found. Run seed_roles.sql first.");
    }

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [userResult.rows[0].id, adminRole.rows[0].id],
    );

    await client.query("COMMIT");

    console.log("Super Administrator created successfully.");
    console.log("Name:", userResult.rows[0].full_name);
    console.log("Email:", userResult.rows[0].email);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

createAdmin()
  .catch((error) => {
    console.error("Administrator setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
