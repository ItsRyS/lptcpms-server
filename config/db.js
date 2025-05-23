import mysql from "mysql2/promise";
import dotenv from "dotenv";
import logger from "../config/logger.js";

dotenv.config();

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME", "DB_PORT"];
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    logger.error(`Environment variable ${key} is missing or undefined.`);
    process.exit(1);
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

async function connectWithRetry(maxRetries = 5, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await pool.getConnection();
      logger.info("Connected to MySQL database successfully.");
      conn.release();
      return;
    } catch (err) {
      logger.error(`Attempt ${attempt} failed to connect to MySQL: ${err.message}`);
      if (attempt === maxRetries) {
        logger.error("Max retries reached. Database unavailable.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

connectWithRetry();

export const db = {
  pool,
  query: async (sql, params) => {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      logger.error(`Database query error: ${err.message}`);
      throw err;
    }
  },
};
