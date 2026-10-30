import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { calculateQuote, Vehicle } from "./services/pricing.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "transporteur-api" }));

const quoteSchema = z.object({
  vehicle: z.enum(["BERLINE", "VAN", "ELECTRIC"]),
  distanceKm: z.number().finite().nonnegative(),
  durationMinutes: z.number().finite().nonnegative(),
  fixedFareEuros: z.number().finite().nonnegative().optional()
});

app.post("/api/pricing/quote", (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_QUOTE_INPUT", details: parsed.error.flatten() });
  const quote = calculateQuote({ ...parsed.data, vehicle: parsed.data.vehicle as Vehicle });
  return res.json(quote);
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Transporteur API listening on :${port}`));
