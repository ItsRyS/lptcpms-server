import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { db } from "./config/db.js";
import logger from "./config/logger.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "https://lptcpms.vercel.app",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate Limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
  })
);

// Routes

app.get("/", (req, res) => {
  res.send("Hello from server");
});

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "OK", uptime: process.uptime(), database: "connected" });
  } catch (err) {
    logger.error("Health check failed:", err);
    res.status(503).json({ status: "ERROR", database: "disconnected" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  logger.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => {
  logger.info(`App listening on port ${port}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Closing server...");
  server.close(() => {
    logger.info("Server closed.");
    db.pool.end(() => {
      logger.info("Database connection pool closed.");
      process.exit(0);
    });
  });
});
