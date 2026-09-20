import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./health.js";
import analyzeRouter from "./routes/analyze.js";
import sessionsRouter from "./routes/sessions.js";
import imageRouter from "./routes/image.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/", healthRouter);
app.use("/", analyzeRouter);
app.use("/", sessionsRouter);
app.use("/", imageRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
