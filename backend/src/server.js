import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import assistantRoutes from "./routes/assistant.routes.js";
import circularRoutes from "./routes/circular.routes.js";
import newsRoutes from "./routes/news.routes.js";
import wellnessRoutes from "./routes/wellness.routes.js";
import taskRoutes from "./routes/task.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import { detectLanguage } from "./middleware/lang.middleware.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(detectLanguage);

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/circulars", circularRoutes);
app.use("/api/circular", circularRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/wellness", wellnessRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/meetings", meetingRoutes);


app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`K-SMART CARE backend running on http://localhost:${PORT}`);
  });
});
