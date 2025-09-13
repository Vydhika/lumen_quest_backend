import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import routes from "./src/routes/index.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api", routes);

// Root Route
app.get("/", (req, res) => {
  res.send("API is running... yaaaaaay!");
});

// User Routes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
