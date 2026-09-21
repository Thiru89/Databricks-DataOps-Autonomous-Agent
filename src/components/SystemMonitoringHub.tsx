import React, { useState } from "react";
import { Activity, Database, AlertCircle, CheckCircle2, Play, Copy, Check } from "lucide-react";

interface SystemMonitoringHubProps {
  catalog: string;
  schema: string;
}

export const SystemMonitoringHub: React.FC<SystemMonitoringHubProps> = ({ catalog, schema }) => {
  const [activeQueryIndex, setActiveQueryIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const queries = [
    {
      title: "DLT Pipeline Events & Expectations (system.lakeflow.pipeline_events)",
      desc: "Track dropped records, quarantine events, and data quality pass rates",
      sql: `SELECT 
    timestamp,
    message,
    details:flow_name::string AS table_name,
    details:data_quality:expectations AS expectations_evaluated,
    details:data_quality:dropped_records::int AS dropped_count,
    details:data_quality:passed_records::int AS passed_count
FROM system.lakeflow.pipeline_events
WHERE pipeline_id = 'dlt-pipeline-uuid-${schema}-01'
  AND timestamp >= current_timestamp() - INTERVAL 24 HOURS
  AND event_type = 'flow_progress'
ORDER BY timestamp DESC;`,
    },
    {
      title: "Job Run Timeline & OutOfMemory Check (system.operational_data)",
      desc: "Audit job duration, task retry counts, and JVM exit statuses",
      sql: `SELECT 
    event_time, 
    job_id, 
    run_id, 
    task_key, 
    execution_duration_ms / 1000 AS duration_sec,
    termination_details:type AS termination_type,
    termination_details:message AS failure_message
FROM system.operational_data.job_run_timeline
WHERE job_name LIKE '%${schema}%'
  AND event_time >= current_timestamp() - INTERVAL 7 DAYS
ORDER BY event_time DESC;`,
    },
    {
      title: "DBU Cost & Cluster Consumption (system.billing.usage)",
      desc: "Monitor Databricks Unit (DBU) consumption for Auto Loader and DLT",
      sql: `SELECT 
    usage_date,
    sku_name,
    usage_metadata:cluster_id::string AS cluster_id,
    SUM(usage_quantity) AS total_dbus,
    SUM(usage_quantity * 0.40) AS estimated_usd_cost
FROM system.billing.usage
WHERE identity_metadata:run_as::string LIKE '%dataops%'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY usage_date, sku_name, cluster_id
ORDER BY usage_date DESC;`,
    },
  ];

  const currentQuery = queries[activeQueryIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentQuery.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              Unity Catalog System Tables Telemetry Hub
            </h3>
            <p className="text-xs text-stone-700">
              Query audit, lineage, and operational metrics using official system tables
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied SQL!" : "Copy System SQL"}</span>
        </button>
      </div>

      {/* Query Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {queries.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveQueryIndex(idx)}
            className={`text-left p-3 rounded-lg border text-xs transition-all cursor-pointer min-w-[240px] shrink-0 ${
              activeQueryIndex === idx
                ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-200 text-stone-900 font-semibold"
                : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <div className="font-bold text-[11px] truncate mb-1">{q.title.split("(")[0]}</div>
            <div className="text-[10px] text-stone-700 truncate">{q.desc}</div>
          </button>
        ))}
      </div>

      {/* SQL Editor View */}
      <div className="rounded-lg overflow-hidden border border-stone-800 bg-stone-900 mb-4">
        <div className="flex items-center justify-between px-3 py-1.5 bg-stone-800 text-stone-400 text-[11px] font-mono">
          <span>{currentQuery.title}</span>
          <span className="text-emerald-400">Databricks SQL Dialect</span>
        </div>
        <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
          {currentQuery.sql}
        </pre>
      </div>

      {/* Simulated Live Expectation Telemetry Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="text-stone-700 block text-[10px]">Data Quality Pass Rate</span>
            <span className="font-bold font-mono text-stone-900 text-sm">99.4% Valid Records</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <span className="text-stone-700 block text-[10px]">Quarantine Table Volume</span>
            <span className="font-bold font-mono text-stone-900 text-sm">312 records / hr</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <span className="text-stone-700 block text-[10px]">SLA Duration (P95)</span>
            <span className="font-bold font-mono text-stone-900 text-sm">4.2 min (Target: 15 min)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
