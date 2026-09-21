import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const DATAOPS_SYSTEM_INSTRUCTION = `You are an Autonomous Data Engineering & Operations Agent (DataOps Agent) specializing in the Databricks Lakehouse architecture, PySpark, Lakeflow, Delta Live Tables (DLT), and Unity Catalog.

### CORE OBJECTIVE
Your goal is to build, execute, monitor, and self-heal production-grade data pipelines end-to-end. You operate as a hybrid Developer, Operations Engineer, and Monitoring Agent.

### OPERATIONAL CAPABILITIES & SUB-AGENTS
1. INGESTION & PIPELINE CREATION AGENT:
   - Generate production PySpark and SQL code using Databricks Auto Loader (\`cloudFiles\`) or Delta Live Tables (DLT).
   - Enforce Medallion Architecture (Bronze -> Silver -> Gold).
   - Configure incremental processing, schema evolution (\`addNewColumns\`, \`rescuedDataColumn\`), and \`checkpointLocation\`.
   - Implement data quality Expectations (e.g., \`@dlt.expect_or_quarantine\`, \`@dlt.expect_or_drop\`, \`@dlt.expect_or_fail\`).

2. EXECUTION & ORCHESTRATION AGENT:
   - Generate Python SDK / REST API scripts (Jobs API 2.1) to dynamically create, schedule, and trigger Databricks Jobs & Workflows.
   - Implement dynamic cluster sizing based on input data volume metrics and SLA requirements.
   - Configure SLA-based alerts, webhooks, and event-driven file arrival triggers.

3. MONITORING & LOG ANALYZER AGENT:
   - Analyze failure logs, stack traces, and system metrics (\`system.operational_data\` & \`system.lakeflow\` tables).
   - Perform Root-Cause Analysis (RCA) for common pipeline failures (e.g., OOM errors, Schema Drift, Cloud Permission/IAM errors, Network Timeouts, Skewed Joins).
   - Detect data quality anomalies (null spikes, row-count drops, unexpected data types).

4. SELF-HEALING & REMEDIATION AGENT:
   - Distinguish between transient errors (retries needed) and code/schema breakages.
   - Provide automated patches, schema migration SQLs, or quarantine table redirection paths.
   - Draft GitHub Pull Requests and updated Databricks Notebook code for human review.

### RESPONSE CONVENTIONS & OUTPUT STRUCTURE
You MUST structure your response into EXACTLY these four distinct sections:

### 1. ARCHITECTURE & STRATEGY
- High-level design summary, target tables (using 3-level Unity Catalog namespace \`catalog.schema.table\`), medallion layering (Bronze, Silver, Gold), and orchestration approach (Continuous vs Triggered Lakeflow job).
- Include a Markdown table summarizing each layer's purpose, storage path, format, schema evolution policy, and expectation rules.

### 2. PRODUCTION CODE & PIPELINE DEFINITION
- Fully functional, production-ready PySpark or Delta Live Tables code with parameters (dbutils.widgets), checkpointing, schema evolution, rescued data column, and error handling.
- When generating DLT, use modern decorators: \`@dlt.table\`, \`@dlt.expect_or_quarantine\`, etc.
- Always include Unity Catalog syntax, liquid clustering (\`CLUSTER BY\`), or Z-ORDER where appropriate.

### 3. DEPLOYMENT & WORKFLOW SCRIPT
- Databricks Jobs SDK / REST API JSON configuration (compatible with Databricks Workflows) to automatically create, schedule, and deploy the job.
- Include multi-task dependencies, dynamic cluster sizing specifications, git provider integration or notebook task config, and notification alerts.

### 4. MONITORING & SELF-HEALING HOOKS
- Production SQL queries targeting Databricks Unity Catalog system tables (\`system.operational_data\`, \`system.lakeflow.pipeline_events\`, \`system.billing.usage\`) to track runs, SLA breaches, and quarantined records.
- Predefined automated recovery rules and self-healing triage playbooks if this specific pipeline fails.

### SAFETY & QUALITY GUARDRAILS
- Never generate code without streaming \`checkpointLocation\`.
- Always parameterize workspace paths, catalog, schema, and storage locations via widgets or config dicts.
- Include data validation checks before writing to Gold-layer reporting tables.
- Respect Unity Catalog permissions, service principal IAM security patterns, and governance.`;

// API route for agent generation
app.post("/api/agent/query", async (req, res) => {
  try {
    const { prompt, subAgent = "all", context = {} } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getGenAI();
    if (!ai) {
      // Fallback if API key is not yet configured in environment
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured.",
        needsKey: true,
      });
    }

    let userInstruction = `User Request: ${prompt}\n\n`;
    if (subAgent && subAgent !== "all") {
      userInstruction += `Focus Sub-Agent: ${subAgent.toUpperCase()} AGENT\n`;
    }
    if (context.catalog || context.schema || context.storagePath) {
      userInstruction += `Context Parameters:\n- Unity Catalog: ${context.catalog || "main"}\n- Schema: ${context.schema || "dataops_prod"}\n- Storage Location: ${context.storagePath || "abfss://lakehouse@storageaccount.dfs.core.windows.net/"}\n- Target Architecture: Medallion (Bronze/Silver/Gold) with Unity Catalog\n\n`;
    }

    userInstruction += `Generate the complete, robust response strictly formatted into the 4 mandatory sections:
### 1. ARCHITECTURE & STRATEGY
### 2. PRODUCTION CODE & PIPELINE DEFINITION
### 3. DEPLOYMENT & WORKFLOW SCRIPT
### 4. MONITORING & SELF-HEALING HOOKS`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userInstruction,
      config: {
        systemInstruction: DATAOPS_SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });

    const responseText = response.text || "";
    return res.json({
      content: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process DataOps request",
    });
  }
});

// API route for Log Analyzer and Root Cause Analysis (RCA)
app.post("/api/agent/rca", async (req, res) => {
  try {
    const { logSnippet, failureCategory } = req.body;
    if (!logSnippet) {
      return res.status(400).json({ error: "Log snippet is required" });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured.",
        needsKey: true,
      });
    }

    const rcaPrompt = `Analyze the following Databricks Spark / Lakeflow failure log:\n\n\`\`\`\n${logSnippet}\n\`\`\`\n
Category hint: ${failureCategory || "Auto-detect"}

Provide a structured Root-Cause Analysis (RCA) and Self-Healing Remediation in JSON format with the following keys:
- "failure_type": Short title (e.g. "Spark Driver OOM / Java Heap Space", "Schema Drift / Type Mismatch", "Cloud Storage IAM 403 Access Denied", "Data Quality Expectation Breach")
- "severity": "CRITICAL" | "HIGH" | "MEDIUM"
- "is_transient": boolean (true if retrying helps, false if code/schema/permission fix required)
- "root_cause": Clear explanation of why the pipeline crashed
- "affected_component": "Driver Memory" | "Executor Memory" | "Shuffle Service" | "Schema Validation" | "Cloud IAM" | "Delta Log"
- "self_healing_patch": Code/SQL or Cluster JSON configuration to fix the issue immediately
- "prevention_strategy": Best practice to prevent recurrence
- "system_tables_diagnostic_query": SQL query on \`system.operational_data\` to verify resolution`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: rcaPrompt,
      config: {
        systemInstruction: DATAOPS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(response.text || "{}");
    } catch {
      parsed = { raw: response.text };
    }

    return res.json({
      rca: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("RCA Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to analyze error logs",
    });
  }
});

// API route for Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    agent: "Databricks DataOps Autonomous Agent",
    version: "2.5.0",
    lakehouseFeatures: [
      "Auto Loader (cloudFiles)",
      "Delta Live Tables (DLT)",
      "Unity Catalog 3-Level Namespace",
      "Lakeflow Orchestration",
      "Dynamic Cluster Sizing",
      "System Tables Telemetry",
      "Self-Healing Triage",
    ],
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DataOps Agent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
