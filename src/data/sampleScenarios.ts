import { PresetScenario, LogSample } from "../types";

export const SAMPLE_LOGS: LogSample[] = [
  {
    id: "log-oom",
    title: "Driver OutOfMemory (Heap Space) During Wide Shuffled Join",
    category: "OOM / Memory Exhaustion",
    severity: "CRITICAL",
    snippet: `26/09/21 14:12:04 ERROR ApplicationMaster: User class threw exception: java.lang.OutOfMemoryError: Java heap space
	at java.base/java.util.Arrays.copyOf(Arrays.java:3537)
	at java.base/java.io.ByteArrayOutputStream.grow(ByteArrayOutputStream.java:118)
	at java.base/java.io.ByteArrayOutputStream.write(ByteArrayOutputStream.java:135)
	at org.apache.spark.serializer.KryoSerializationStream.writeAll(KryoSerializer.scala:189)
	at org.apache.spark.sql.execution.joins.HashedRelation$.apply(HashedRelation.scala:389)
	at org.apache.spark.sql.execution.joins.BroadcastHashJoinExec.prepareBroadcast(BroadcastHashJoinExec.scala:125)
	at org.apache.spark.sql.execution.joins.BroadcastHashJoinExec.executeBroadcast(BroadcastHashJoinExec.scala:142)
26/09/21 14:12:05 WARN TaskSetManager: Lost task 412.0 in stage 14.0 (TID 1290) on 10.139.64.12: ExecutorLostFailure (executor 4 lost, reason: Worker heartbeat timeout)
26/09/21 14:12:06 ERROR DatabricksJobRunner: Job run failed with exit code 137 (SIGKILL by Linux OOM killer). Input partition size exceeded driver memory limit (driver=4GB, partition_estimate=7.8GB).`
  },
  {
    id: "log-schema-drift",
    title: "Delta Table Schema Drift Type Mismatch (String to Integer)",
    category: "Schema Drift & Type Mismatch",
    severity: "HIGH",
    snippet: `org.apache.spark.sql.AnalysisException: A schema mismatch detected when writing to the Delta table.
A column in the new data has a different data type than the target Delta table:
- Table column: 'transaction_amount' (DOUBLE)
- Data column:  'transaction_amount' (STRING with currency symbols like '$120.50')
Delta does not automatically cast incompatible types during append operations without explicit migration or rescued data column mapping.
Auto Loader rescue column '_rescued_data' enabled: false.
Streaming micro-batch 837 failed at checkpoint location: /mnt/lakehouse/checkpoints/silver_transactions/_spark_metadata/837.`
  },
  {
    id: "log-iam-403",
    title: "Unity Catalog External Storage Credential 403 Forbidden",
    category: "Cloud IAM / Storage Permission",
    severity: "HIGH",
    snippet: `com.databricks.backend.daemon.data.client.DatabricksClientException: [PERMISSION_DENIED]
User lacks required permission 'READ_FILES' on External Location 'abfss://raw-data@adlsstorageprod.dfs.core.windows.net/telemetry/'.
Underlying cloud provider exception:
Server failed to authenticate the request with Azure Active Directory (Managed Identity).
Error code: AuthorizationPermissionMismatch (403 Forbidden).
Caller client ID: c487a912-3321-4f9e-b901-7fa882314012
Target Storage Container: raw-data
Unity Catalog Catalog: enterprise_lakehouse
Unity Catalog Storage Credential: prod_azure_storage_credential`
  },
  {
    id: "log-dlt-expectation",
    title: "DLT Expectation Drop Rate Exceeded SLA Threshold (>5% invalid)",
    category: "Data Quality Anomaly",
    severity: "MEDIUM",
    snippet: `[DLT-QUALITY-ALERT] Table 'enterprise_lakehouse.telemetry_silver.clean_iot_events'
Expectation 'valid_temperature_reading' (reading BETWEEN -50 AND 150) failed for 18,940 records in microbatch 1042.
Expectation failure rate: 14.82% (Critical threshold: 5.00%).
Table configured with '@dlt.expect_or_fail' caused current pipeline update 'update-a892b10' to terminate with status FAILED.
Triggered alert webhook: PagerDuty-Sev2-DataOps.`
  }
];

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "clickstream-dlt",
    title: "E-Commerce Clickstream Ingestion (DLT + Quarantine)",
    description: "Auto Loader JSON ingestion to Bronze, DLT expectation quarantine to Silver, and Gold session revenue analytics.",
    subAgent: "ingestion",
    tags: ["Auto Loader", "DLT", "Quarantine", "Medallion", "Unity Catalog"],
    prompt: "Build an end-to-end Medallion pipeline for high-volume E-Commerce clickstream events. Ingest raw JSON with Auto Loader, quarantine malformed user sessions in Silver, and compute daily customer conversion aggregates in Gold with Liquid Clustering.",
    context: {
      catalog: "ecommerce_prod",
      schema: "clickstream",
      storagePath: "abfss://lakehouse@storeadls.dfs.core.windows.net/events",
      sourceFormat: "json",
      clusterType: "autoscaling",
      slaMinutes: 15
    },
    precomputedResponse: {
      raw: "",
      sections: {
        architecture: `### 1. ARCHITECTURE & STRATEGY

#### 1.1 Architecture Design & Data Flow
The proposed architecture implements the **Medallion Architecture (Bronze -> Silver -> Gold)** backed by **Databricks Unity Catalog** and **Delta Live Tables (DLT)**. It enables continuous, fault-tolerant ingestion of raw E-Commerce events with automated quarantine isolation for malformed sessions.

\`\`\`
[ Cloud Storage (ADLS Gen2 / S3) ]
             |
             v (Auto Loader 'cloudFiles' with Schema Evolution)
[ Bronze: ecommerce_prod.clickstream.raw_events_bronze ]
             |
             +---> [ Silver Quarantine: ecommerce_prod.clickstream.invalid_events_quarantine ]
             |          (failed session_id or timestamp expectations)
             v
[ Silver: ecommerce_prod.clickstream.clean_sessions_silver ]
             |  (Liquid Clustering CLUSTER BY (event_date, user_id))
             v (Stateful Windowed Aggregation & Enrichment)
[ Gold: ecommerce_prod.clickstream.daily_customer_conversions_gold ]
\`\`\`

#### 1.2 Medallion Table Specifications
| Layer | Target Table | Format | Ingestion Engine | Schema Policy | Data Quality Expectations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bronze** | \`ecommerce_prod.clickstream.raw_events_bronze\` | Delta | Auto Loader (\`cloudFiles\`) | \`addNewColumns\`, \`_rescued_data\` | None (Append-only Raw Audit) |
| **Silver** | \`ecommerce_prod.clickstream.clean_sessions_silver\` | Delta | DLT Incremental | Strict | \`valid_user_id\`, \`valid_session_timestamp\` |
| **Quarantine**| \`ecommerce_prod.clickstream.invalid_events_quarantine\`| Delta | DLT Quarantine | Free-form | Captured failed rows with error reason |
| **Gold** | \`ecommerce_prod.clickstream.daily_customer_conversions_gold\`| Delta | DLT Materialized View | Enforced Typed | \`positive_gmv\`, \`valid_conversion_rate\` |

#### 1.3 Orchestration & Governance Strategy
- **Catalog Governance:** Managed under Unity Catalog \`ecommerce_prod\` with column-level masking on \`user_ip\` and \`payment_token\`.
- **Pipeline Mode:** Triggered every 15 minutes (or Continuous for sub-minute SLA) via Databricks Lakeflow Workflows.
- **Clustering:** Liquid Clustering (\`CLUSTER BY (event_date, user_id)\`) replacing legacy Z-ORDER for zero-maintenance table optimization.`,

        code: `### 2. PRODUCTION CODE & PIPELINE DEFINITION

\`\`\`python
# Databricks Notebook source
# COMMAND ----------
# MAGIC %md
# MAGIC # Production Clickstream Medallion Pipeline (DLT + Auto Loader)
# MAGIC **Catalog:** \`ecommerce_prod\` | **Schema:** \`clickstream\`

# COMMAND ----------
import dlt
from pyspark.sql.functions import (
    col, current_timestamp, to_date, from_unixtime,
    when, count, sum, expr, lit
)
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType, LongType, TimestampType
)

# -------------------------------------------------------------------------
# Configuration Parameters via dbutils or DLT pipeline configuration
# -------------------------------------------------------------------------
SOURCE_PATH = spark.conf.get(
    "pipeline.source_path",
    "abfss://lakehouse@storeadls.dfs.core.windows.net/events/raw_json/"
)
CHECKPOINT_BASE = spark.conf.get(
    "pipeline.checkpoint_path",
    "abfss://lakehouse@storeadls.dfs.core.windows.net/checkpoints/clickstream/"
)

# -------------------------------------------------------------------------
# BRONZE LAYER: Raw Event Ingestion with Auto Loader
# -------------------------------------------------------------------------
@dlt.table(
    name="raw_events_bronze",
    comment="Raw streaming clickstream ingested continuously via Auto Loader cloudFiles",
    table_properties={
        "quality": "bronze",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    }
)
def raw_events_bronze():
    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("cloudFiles.schemaLocation", f"{CHECKPOINT_BASE}/schema_bronze")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.rescuedDataColumn", "_rescued_data")
        .load(SOURCE_PATH)
        .withColumn("_ingestion_timestamp", current_timestamp())
        .withColumn("_source_file", col("_metadata.file_name"))
    )

# -------------------------------------------------------------------------
# SILVER LAYER: Cleansed Clickstream with Data Quality Expectations
# -------------------------------------------------------------------------
silver_rules = {
    "valid_event_id": "event_id IS NOT NULL",
    "valid_user_id": "user_id IS NOT NULL AND length(trim(user_id)) > 0",
    "valid_timestamp": "event_timestamp IS NOT NULL AND event_timestamp <= current_timestamp()"
}

@dlt.table(
    name="clean_sessions_silver",
    comment="Cleansed and validated user clickstream sessions with expectation quarantine",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.zOrderCols": "event_date,user_id"
    }
)
@dlt.expect_all_or_drop(silver_rules)
def clean_sessions_silver():
    return (
        dlt.read_stream("raw_events_bronze")
        .filter(col("_rescued_data").isNull())
        .withColumn("event_date", to_date(col("event_timestamp")))
        .withColumn("order_value", when(col("order_value").isNull(), 0.0).otherwise(col("order_value").cast(DoubleType())))
        .select(
            "event_id",
            "session_id",
            "user_id",
            "event_type",
            "page_url",
            "order_value",
            "event_timestamp",
            "event_date",
            "_ingestion_timestamp"
        )
    )

# -------------------------------------------------------------------------
# SILVER QUARANTINE: Isolated Records that Failed Quality Rules
# -------------------------------------------------------------------------
@dlt.table(
    name="invalid_events_quarantine",
    comment="Quarantined records failing silver quality expectations for operational audit",
    table_properties={"quality": "quarantine"}
)
def invalid_events_quarantine():
    return (
        dlt.read_stream("raw_events_bronze")
        .filter(
            (col("event_id").isNull()) |
            (col("user_id").isNull()) |
            (col("event_timestamp").isNull()) |
            (col("_rescued_data").isNotNull())
        )
        .withColumn("_quarantine_reason", when(col("_rescued_data").isNotNull(), "Schema Evolution Rescued Column")
                                          .when(col("event_id").isNull(), "Null Event ID")
                                          .otherwise("Invalid User or Timestamp"))
        .withColumn("_quarantine_time", current_timestamp())
    )

# -------------------------------------------------------------------------
# GOLD LAYER: Business Aggregation (Daily Customer Conversion & GMV)
# -------------------------------------------------------------------------
@dlt.table(
    name="daily_customer_conversions_gold",
    comment="Aggregated daily metrics by customer with Liquid Clustering",
    table_properties={
        "quality": "gold",
        "delta.enableLiquidClustering": "true"
    }
)
@dlt.expect_or_fail("positive_gmv", "total_gmv >= 0")
def daily_customer_conversions_gold():
    return (
        dlt.read("clean_sessions_silver")
        .groupBy("event_date", "user_id")
        .agg(
            count("event_id").alias("total_interactions"),
            sum(when(col("event_type") == "checkout", 1).otherwise(0)).alias("completed_purchases"),
            sum("order_value").alias("total_gmv")
        )
        .withColumn("conversion_rate", expr("completed_purchases / total_interactions"))
        .withColumn("_gold_updated_at", current_timestamp())
    )
\`\`\``,

        workflow: `### 3. DEPLOYMENT & WORKFLOW SCRIPT

\`\`\`json
{
  "name": "DataOps_DLT_Clickstream_Pipeline_Trigger",
  "email_notifications": {
    "on_failure": ["dataops-oncall@ecommerce.com"],
    "on_duration_warning_threshold_exceeded": ["lead-engineer@ecommerce.com"]
  },
  "webhook_notifications": {
    "on_failure": [
      {
        "id": "pagerduty_dataops_p1_alert"
      }
    ]
  },
  "timeout_seconds": 3600,
  "health": {
    "rules": [
      {
        "metric": "RUN_DURATION_SECONDS",
        "op": "GREATER_THAN",
        "value": 900
      }
    ]
  },
  "schedule": {
    "quartz_cron_expression": "0 0/15 * * * ?",
    "timezone_id": "UTC",
    "pause_status": "UNPAUSED"
  },
  "tasks": [
    {
      "task_key": "run_dlt_pipeline",
      "pipeline_task": {
        "pipeline_id": "dlt-pipeline-uuid-clickstream-01",
        "full_refresh": false
      },
      "timeout_seconds": 1800
    },
    {
      "task_key": "verify_quarantine_threshold",
      "depends_on": [
        {
          "task_key": "run_dlt_pipeline"
        }
      ],
      "spark_sql_task": {
        "query": "SELECT CASE WHEN count(*) > 1000 THEN raise_error('Quarantine threshold breached (>1000 rows)!') ELSE 'PASSED' END FROM ecommerce_prod.clickstream.invalid_events_quarantine WHERE _quarantine_time >= current_timestamp() - INTERVAL 15 MINUTES",
        "warehouse_id": "sql_warehouse_serverless_id_01"
      }
    }
  ],
  "format": "MULTI_TASK"
}
\`\`\``,

        monitoring: `### 4. MONITORING & SELF-HEALING HOOKS

#### 4.1 System Tables Telemetry Queries (Unity Catalog)

\`\`\`sql
-- Query 1: Track Pipeline Data Quality & Expectations Status
SELECT 
    timestamp,
    message,
    details:flow_name::string AS table_name,
    details:data_quality:expectations AS expectations_evaluated,
    details:data_quality:dropped_records::int AS dropped_count,
    details:data_quality:passed_records::int AS passed_count
FROM system.lakeflow.pipeline_events
WHERE pipeline_id = 'dlt-pipeline-uuid-clickstream-01'
  AND timestamp >= current_timestamp() - INTERVAL 24 HOURS
  AND event_type = 'flow_progress'
ORDER BY timestamp DESC;

-- Query 2: Audit Quarantined Records in Last 2 Hours
SELECT 
    _quarantine_reason,
    COUNT(*) AS record_count,
    MIN(_quarantine_time) AS earliest_failure,
    MAX(_quarantine_time) AS latest_failure
FROM ecommerce_prod.clickstream.invalid_events_quarantine
WHERE _quarantine_time >= current_timestamp() - INTERVAL 2 HOURS
GROUP BY _quarantine_reason
ORDER BY record_count DESC;
\`\`\`

#### 4.2 Automated Self-Healing & Remediation Playbook
1. **Transient Network or ADLS 503 Throttling:**
   - Databricks Jobs will automatically retry task up to 3 times with exponential backoff (\`retry_on_timeout: true\`).
2. **Schema Drift / Unexpected JSON Keys:**
   - Auto Loader automatically writes new fields to \`raw_events_bronze\` using \`addNewColumns\`.
   - Incompatible datatypes are routed without crashing to \`_rescued_data\` and segregated into \`invalid_events_quarantine\`.
3. **Quarantine Spike Remediation Script:**
   - Execute the self-healing replay query after updating the schema definition:
   \`\`\`sql
   INSERT INTO ecommerce_prod.clickstream.clean_sessions_silver
   SELECT 
       event_id, session_id, user_id, event_type, page_url, 
       order_value, event_timestamp, to_date(event_timestamp), current_timestamp()
   FROM ecommerce_prod.clickstream.invalid_events_quarantine
   WHERE _quarantine_reason = 'Null Event ID' 
     AND event_id IS NOT NULL;
   \`\`\``
      }
    }
  },
  {
    id: "financial-sla",
    title: "Financial Transactions (Strict SLA & Audit Ledger)",
    description: "High-integrity payment transaction pipeline with row-level hashing, idempotency, and audit trails.",
    subAgent: "orchestration",
    tags: ["Financial", "Idempotency", "Audit", "Unity Catalog RBAC", "SLA"],
    prompt: "Generate a financial transaction processing pipeline in PySpark with strict idempotency (MERGE INTO), Unity Catalog row-level audit hashing, SLA alerting under 5 minutes, and automated reconciliation checks.",
    context: {
      catalog: "fintech_prod",
      schema: "payments",
      storagePath: "abfss://payments@securestorage.dfs.core.windows.net/transactions",
      sourceFormat: "delta",
      clusterType: "serverless",
      slaMinutes: 5
    }
  },
  {
    id: "iot-autoloader",
    title: "IoT Sensor Streaming with Rescued Data Evolution",
    description: "Telemetry ingestion from millions of IoT sensors handling schema variations and null telemetry spikes.",
    subAgent: "ingestion",
    tags: ["IoT", "Auto Loader", "Schema Evolution", "Rescued Column"],
    prompt: "Design an Auto Loader PySpark streaming pipeline for industrial IoT sensors. Handle schema evolution with rescued data column, compute 10-minute tumbling window metrics, and detect temperature/vibration anomalies.",
    context: {
      catalog: "manufacturing_prod",
      schema: "iot_telemetry",
      storagePath: "s3://iot-sensor-telemetry-prod/events/",
      sourceFormat: "json",
      clusterType: "autoscaling",
      slaMinutes: 10
    }
  }
];
