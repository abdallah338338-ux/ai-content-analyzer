import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./health.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/", healthRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
