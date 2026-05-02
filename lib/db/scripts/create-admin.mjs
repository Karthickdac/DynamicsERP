#!/usr/bin/env node
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const email = process.env.ADMIN_EMAIL || "admin@dynamicgreenenergy.in";
const password = process.env.ADMIN_PASSWORD || "password123";
const firstName = process.env.ADMIN_FIRST_NAME || "Admin";
const lastName = process.env.ADMIN_LAST_NAME || "User";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const existing = await pool.query("select id, email, role from users where email = $1", [email]);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing.rows.length > 0) {
    await pool.query(
      "update users set password_hash = $1, role = 'admin', is_active = true, first_name = $2, last_name = $3 where email = $4",
      [passwordHash, firstName, lastName, email],
    );
    console.log(`Updated existing user ${email} -> role=admin, password reset, active=true`);
  } else {
    await pool.query(
      `insert into users (email, password_hash, first_name, last_name, role, is_active)
       values ($1, $2, $3, $4, 'admin', true)`,
      [email, passwordHash, firstName, lastName],
    );
    console.log(`Created admin user ${email}`);
  }
  console.log(`Login with:  email=${email}  password=${password}`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
