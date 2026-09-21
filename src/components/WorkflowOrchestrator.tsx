import React, { useState, useId } from "react";
import { Cpu, Sliders, Zap, Check, Copy, Download, Clock, ShieldCheck } from "lucide-react";

interface WorkflowOrchestratorProps {
  catalog: string;
  schema: string;
}

export const WorkflowOrchestrator: React.FC<WorkflowOrchestratorProps> = ({ catalog, schema }) => {
  const [dataVolumeGbPerHour, setDataVolumeGbPerHour] = useState<number>(120);
  const [slaMinutes, setSlaMinutes] = useState<number>(15);
  const [runtimeMode, setRuntimeMode] = useState<"serverless" | "classic_autoscale">("serverless");
  const [copied, setCopied] = useState<boolean>(false);

  const dataVolumeInputId = useId();
  const slaMinutesInputId = useId();

  // Dynamic Cluster Sizing Calculation Logic
  const throughputPerWorkerGb = 25; // standard throughput GB/hr per Standard_D4ds_v5 or i3.xlarge
  const minWorkersCalc = Math.max(1, Math.ceil(dataVolumeGbPerHour / (throughputPerWorkerGb * 2)));
  const maxWorkersCalc = Math.max(minWorkersCalc + 2, Math.ceil((dataVolumeGbPerHour * 1.8) / throughputPerWorkerGb));
  const estimatedDbuPerHour = runtimeMode === "serverless"
    ? (dataVolumeGbPerHour * 0.14).toFixed(1)
    : (minWorkersCalc * 1.5 + 1.5).toFixed(1);

  const jobsApiPayload = {
    name: `Lakeflow_${catalog}_${schema}_ETL_Job`,
    email_notifications: {
      on_failure: ["dataops-oncall@enterprise.com"],
      on_duration_warning_threshold_exceeded: ["dataops-leads@enterprise.com"]
    },
    timeout_seconds: slaMinutes * 120,
    health: {
      rules: [
        {
          metric: "RUN_DURATION_SECONDS",
          op: "GREATER_THAN",
          value: slaMinutes * 60
        }
      ]
    },
    trigger: {
      pause_status: "UNPAUSED",
      file_arrival: {
        url: `abfss://lakehouse@storage.dfs.core.windows.net/${schema}/landing/`,
        min_time_between_triggers_seconds: 300
      }
    },
    tasks: [
      {
        task_key: "bronze_autoloader_ingest",
        description: "Continuous micro-batch ingestion via cloudFiles Auto Loader",
        notebook_task: {
          notebook_path: `/Workspace/DataOps/Pipelines/${schema}_bronze_ingest`,
          base_parameters: {
            catalog: catalog,
            schema: schema,
            source_volume_gb: `${dataVolumeGbPerHour}`
          }
        },
        job_cluster_key: "dynamic_sizing_cluster"
      },
      {
        task_key: "silver_dlt_expectations_quarantine",
        depends_on: [{ task_key: "bronze_autoloader_ingest" }],
        pipeline_task: {
          pipeline_id: "lakeflow-dlt-pipeline-id-v2"
        }
      }
    ],
    job_clusters: [
      {
        job_cluster_key: "dynamic_sizing_cluster",
        new_cluster: runtimeMode === "serverless" ? {
          spark_version: "15.4.x-scala2.12",
          runtime_engine: "PHOTON",
          data_security_mode: "USER_ISOLATION",
          custom_tags: {
            Workload: "DataOps_AutoLoader",
            CostCenter: "DataEngineering"
          }
        } : {
          spark_version: "15.4.x-scala2.12",
          node_type_id: "Standard_D4ds_v5",
          driver_node_type_id: "Standard_D8ds_v5",
          autoscale: {
            min_workers: minWorkersCalc,
            max_workers: maxWorkersCalc
          },
          spark_conf: {
            "spark.sql.shuffle.partitions": `${Math.max(200, minWorkersCalc * 16)}`,
            "spark.databricks.delta.optimizeWrite.enabled": "true",
            "spark.databricks.delta.autoCompact.enabled": "true"
          },
          data_security_mode: "USER_ISOLATION"
        }
      }
    ],
    format: "MULTI_TASK"
  };

  const jsonString = JSON.stringify(jobsApiPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `databricks_job_${schema}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">
              Execution & Orchestration Agent (Dynamic Cluster Sizer & Jobs API)
            </h3>
            <p className="text-xs text-stone-700">
              Calculate optimal workers from input metrics and generate Databricks Workflows JSON
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "Copy JSON"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Job Spec</span>
          </button>
        </div>
      </div>

      {/* Sizing Parameters & Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div>
          <label htmlFor={dataVolumeInputId} className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1.5">
            <span>Input Ingestion Volume:</span>
            <span className="font-mono text-blue-700">{dataVolumeGbPerHour} GB / hour</span>
          </label>
          <input
            id={dataVolumeInputId}
            type="range"
            min="10"
            max="1000"
            step="10"
            value={dataVolumeGbPerHour}
            onChange={(e) => setDataVolumeGbPerHour(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-700 mt-1">
            <span>10 GB/hr (Batch)</span>
            <span>1,000 GB/hr (Heavy)</span>
          </div>
        </div>

        <div>
          <label htmlFor={slaMinutesInputId} className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1.5">
            <span>SLA Delivery Window:</span>
            <span className="font-mono text-emerald-700">{slaMinutes} Minutes</span>
          </label>
          <input
            id={slaMinutesInputId}
            type="range"
            min="5"
            max="60"
            step="5"
            value={slaMinutes}
            onChange={(e) => setSlaMinutes(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-700 mt-1">
            <span>5 min (Near Real-time)</span>
            <span>60 min (Hourly)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Compute Architecture:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRuntimeMode("serverless")}
              className={`p-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                runtimeMode === "serverless"
                  ? "bg-blue-50/70 border-blue-500 text-blue-900 font-bold"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
              }`}
            >
              Serverless (Photon)
            </button>
            <button
              type="button"
              onClick={() => setRuntimeMode("classic_autoscale")}
              className={`p-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                runtimeMode === "classic_autoscale"
                  ? "bg-blue-50/70 border-blue-500 text-blue-900 font-bold"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
              }`}
            >
              Classic Autoscale
            </button>
          </div>
        </div>
      </div>

      {/* Sizing Recommendations Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
          <span className="text-stone-700 block text-[11px]">Calculated Min Workers:</span>
          <span className="text-base font-bold font-mono text-stone-900">{minWorkersCalc} Workers</span>
        </div>
        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
          <span className="text-stone-700 block text-[11px]">Max Autoscale Ceiling:</span>
          <span className="text-base font-bold font-mono text-stone-900">{maxWorkersCalc} Workers</span>
        </div>
        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
          <span className="text-stone-700 block text-[11px]">Shuffle Partitions:</span>
          <span className="text-base font-bold font-mono text-indigo-700">{Math.max(200, minWorkersCalc * 16)}</span>
        </div>
        <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
          <span className="text-stone-700 block text-[11px]">Estimated DBUs / hr:</span>
          <span className="text-base font-bold font-mono text-emerald-700">{estimatedDbuPerHour} DBU/hr</span>
        </div>
      </div>

      {/* JSON Workflow Preview */}
      <div className="rounded-lg overflow-hidden border border-stone-800 bg-stone-900">
        <div className="flex items-center justify-between px-3 py-1.5 bg-stone-800 text-stone-400 text-[11px] font-mono">
          <span>Databricks Jobs API 2.1 Specification</span>
          <span>MULTI_TASK DAG</span>
        </div>
        <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80 scrollbar-thin">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
