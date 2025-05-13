import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { db } from "./config/db.js";
import logger from "./config/logger.js";
import routes from "./routes/index.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } })); // HTTP logging

// CORS configuration
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

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
  })
);

// Routes
app.use("/api", routes);

// Health check
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "OK", uptime: process.uptime(), database: "connected" });
  } catch (err) {
    logger.error("Health check failed:", err);
    res.status(503).json({ status: "ERROR", database: "disconnected" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`App listening on port ${port}`);
});

// Graceful shutdown
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