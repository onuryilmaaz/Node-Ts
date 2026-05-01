import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Adding username column to app.users table...");
    await client.query("ALTER TABLE app.users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;");
    console.log("Username column added successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
