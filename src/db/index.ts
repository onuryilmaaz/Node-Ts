import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  options: "-c search_path=app,public",
});

/**
 * Execute a raw SQL query
 * @param text SQL query string
 * @param params Query parameters
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV !== 'production') {
    // console.log('executed query', { text, duration, rows: res.rowCount });
  }
  
  return res;
}

// Global db object placeholder for compatibility during transition
export const db = {
  execute: query,
};
