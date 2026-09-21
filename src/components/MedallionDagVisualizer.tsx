import React, { useState } from "react";
import { ArrowRight, Database, ShieldAlert, CheckCircle2, Layers, Sparkles, Filter, RefreshCw } from "lucide-react";

interface MedallionDagProps {
  catalog: string;
  schema: string;
}

export const MedallionDagVisualizer: React.FC<MedallionDagProps> = ({ catalog, schema }) => {
  const [selectedLayer, setSelectedLayer] = useState<"bronze" | "silver" | "quarantine" | "gold">("silver");

  const nodes = {
    bronze: {
      title: "Bronze (Raw Ingest)",
      table: `${catalog}.${schema}.raw_stream_bronze`,
      engine: "Auto Loader (cloudFiles)",
      format: "Delta Lake",
      policy: "schemaEvolution: addNewColumns",
      rescuedColumn: "_rescued_data",
      checkpoint: `/checkpoints/${schema}/bronze`,
      stats: "34,200 msg/sec",
      description: "Immutable, append-only raw telemetry and payload auditing.",
    },
    silver: {
      title: "Silver (Cleansed & Enriched)",
      table: `${catalog}.${schema}.clean_records_silver`,
      engine: "Delta Live Tables (DLT)",
      format: "Delta Lake",
      expectations: [
        "@dlt.expect_or_drop('valid_id', 'id IS NOT NULL')",
        "@dlt.expect_or_quarantine('valid_range', 'amount >= 0')",
      ],
      clustering: "Liquid Clustering: CLUSTER BY (event_date, user_id)",
      checkpoint: `/checkpoints/${schema}/silver`,
      stats: "33,890 rec/sec (99.1% valid)",
      description: "Conformed, typed schema with business-level quality gates.",
    },
    quarantine: {
      title: "Silver Quarantine (Dead-Letter)",
      table: `${catalog}.${schema}.failed_records_quarantine`,
      engine: "DLT Quarantine Stream",
      format: "Delta Lake",
      capturedReason: "Null keys, invalid formats, or schema rescued data",
      retention: "30-day operational triage SLA",
      stats: "310 rec/sec (0.9% quarantined)",
      description: "Isolated malformed records without halting upstream pipelines.",
    },
    gold: {
      title: "Gold (Business Mart)",
      table: `${catalog}.${schema}.daily_analytics_gold`,
      engine: "DLT Materialized View",
      format: "Delta Lake",
      optimization: "Liquid Clustering / Z-ORDER",
      validation: "@dlt.expect_or_fail('positive_metrics', 'total_count > 0')",
      stats: "Daily / Hourly Rollup",
      description: "Aggregated, query-ready dimensional model for BI & ML consumption.",
    },
  };

  const activeData = nodes[selectedLayer];

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-stone-900 text-sm">
            Live Lakehouse Medallion Architecture Flow
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            Unity Catalog Governed
          </span>
        </div>
        <div className="text-xs text-stone-700">
          Click any layer node to inspect schema & expectations
        </div>
      </div>

      {/* Interactive DAG Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {/* Bronze Node */}
        <button
          type="button"
          onClick={() => setSelectedLayer("bronze")}
          className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
            selectedLayer === "bronze"
              ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-200"
              : "bg-stone-50 border-stone-200 hover:border-stone-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-amber-600" /> Bronze Layer
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="font-mono text-xs font-semibold text-stone-900 truncate">
            {nodes.bronze.table.split(".").pop()}
          </div>
          <div className="text-xs text-stone-700 mt-1 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-amber-600" /> Auto Loader
          </div>
          <div className="text-[11px] font-mono text-stone-700 mt-2 bg-white/80 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
            {nodes.bronze.stats}
          </div>
        </button>

        {/* Silver Node */}
        <button
          type="button"
          onClick={() => setSelectedLayer("silver")}
          className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
            selectedLayer === "silver"
              ? "bg-slate-50 border-slate-400 ring-2 ring-slate-200"
              : "bg-stone-50 border-stone-200 hover:border-stone-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> Silver Clean
            </span>
            <span className="w-2 h-2 rounded-full bg-slate-500" />
          </div>
          <div className="font-mono text-xs font-semibold text-stone-900 truncate">
            {nodes.silver.table.split(".").pop()}
          </div>
          <div className="text-xs text-stone-700 mt-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-600" /> DLT Expectations
          </div>
          <div className="text-[11px] font-mono text-stone-700 mt-2 bg-white/80 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
            {nodes.silver.stats}
          </div>
        </button>

        {/* Quarantine Node */}
        <button
          type="button"
          onClick={() => setSelectedLayer("quarantine")}
          className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
            selectedLayer === "quarantine"
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-200"
              : "bg-stone-50 border-stone-200 hover:border-stone-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Quarantine
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="font-mono text-xs font-semibold text-stone-900 truncate">
            {nodes.quarantine.table.split(".").pop()}
          </div>
          <div className="text-xs text-stone-700 mt-1 flex items-center gap-1">
            Dead-Letter Audit
          </div>
          <div className="text-[11px] font-mono text-rose-800 mt-2 bg-white/80 px-2 py-0.5 rounded border border-rose-200/60 inline-block">
            {nodes.quarantine.stats}
          </div>
        </button>

        {/* Gold Node */}
        <button
          type="button"
          onClick={() => setSelectedLayer("gold")}
          className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
            selectedLayer === "gold"
              ? "bg-yellow-50/80 border-yellow-400 ring-2 ring-yellow-200"
              : "bg-stone-50 border-stone-200 hover:border-stone-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-600" /> Gold Mart
            </span>
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
          </div>
          <div className="font-mono text-xs font-semibold text-stone-900 truncate">
            {nodes.gold.table.split(".").pop()}
          </div>
          <div className="text-xs text-stone-700 mt-1 flex items-center gap-1">
            Materialized View
          </div>
          <div className="text-[11px] font-mono text-stone-700 mt-2 bg-white/80 px-2 py-0.5 rounded border border-stone-200/60 inline-block">
            {nodes.gold.stats}
          </div>
        </button>
      </div>

      {/* Layer Detail Drawer */}
      <div className="mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200 text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-stone-900 text-sm flex items-center gap-2">
            <span>{activeData.title}</span>
            <span className="font-mono text-xs font-normal text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded">
              {activeData.table}
            </span>
          </div>
          <span className="font-medium text-stone-600">{activeData.format}</span>
        </div>
        <p className="text-stone-700 mb-3">{activeData.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-stone-200 text-[11px]">
          <div>
            <span className="text-stone-700 block">Processing Engine:</span>
            <span className="font-mono font-medium text-stone-900">{activeData.engine}</span>
          </div>
          {"policy" in activeData && (
            <div>
              <span className="text-stone-700 block">Schema Evolution:</span>
              <span className="font-mono font-medium text-emerald-800">{activeData.policy}</span>
            </div>
          )}
          {"expectations" in activeData && (
            <div className="col-span-2">
              <span className="text-stone-700 block">DLT Expectations:</span>
              <div className="font-mono text-emerald-800 space-y-0.5 mt-0.5">
                {activeData.expectations.map((exp: string, idx: number) => (
                  <div key={idx}>{exp}</div>
                ))}
              </div>
            </div>
          )}
          {"checkpoint" in activeData && (
            <div>
              <span className="text-stone-700 block">Checkpoint Location:</span>
              <span className="font-mono text-stone-800 truncate block">{activeData.checkpoint}</span>
            </div>
          )}
          {"clustering" in activeData && (
            <div>
              <span className="text-stone-700 block">Optimization:</span>
              <span className="font-mono text-indigo-800">{activeData.clustering}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
