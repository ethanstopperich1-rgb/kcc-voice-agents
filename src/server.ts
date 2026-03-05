import "dotenv/config";
import express from "express";
import vapiRouter from "./webhooks/index";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "kcc-voice-agents",
    timestamp: new Date().toISOString(),
  });
});

// Vapi webhook routes
app.use("/vapi", vapiRouter);

// Start server
app.listen(PORT, () => {
  console.log(`\n🎙️  Kitchen Crest Voice AI Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Webhook URL: ${process.env.SERVER_URL || `http://localhost:${PORT}`}/vapi/webhook`);
  console.log(`   Tool Calls:  ${process.env.SERVER_URL || `http://localhost:${PORT}`}/vapi/tool-calls`);
  console.log(`   Health:      http://localhost:${PORT}/health\n`);
});
