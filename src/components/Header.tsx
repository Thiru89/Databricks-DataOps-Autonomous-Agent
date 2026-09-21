import React from "react";
import { Database, ShieldCheck, Activity, Cpu, Wrench, Sparkles } from "lucide-react";
import { SubAgentType } from "../types";

interface HeaderProps {
  activeSubAgent: SubAgentType;
  onSelectSubAgent: (agent: SubAgentType) => void;
  activeCatalog: string;
  activeSchema: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeSubAgent,
  onSelectSubAgent,
  activeCatalog,
  activeSchema,
}) => {
  const subAgents: { id: SubAgentType; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: "all",
      label: "Autonomous Ops Agent",
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      desc: "Full Medallion Pipeline & Ops",
    },
    {
      id: "ingestion",
      label: "Ingestion & DLT Agent",
      icon: <Database className="w-4 h-4 text-emerald-500" />,
      desc: "Auto Loader & Expectations",
    },
    {
      id: "orchestration",
      label: "Execution & Workflows",
      icon: <Cpu className="w-4 h-4 text-blue-500" />,
      desc: "Jobs API & Cluster Sizing",
    },
    {
      id: "monitoring",
      label: "Monitoring & RCA Agent",
      icon: <Activity className="w-4 h-4 text-rose-500" />,
      desc: "Log Analyzer & Diagnostics",
    },
    {
      id: "remediation",
      label: "Self-Healing Engine",
      icon: <Wrench className="w-4 h-4 text-purple-500" />,
      desc: "Patches & Quarantine Triage",
    },
  ];

  return (
    <header className="border-b border-stone-200 bg-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold shadow-xs">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 fill-current"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                  Databricks DataOps Autonomous Agent
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-red-50 text-red-700 border border-red-200">
                  Lakeflow & DLT
                </span>
              </div>
              <p className="text-xs text-stone-700">
                PySpark • Auto Loader • Unity Catalog Governance • 4-Section Deliverable
              </p>
            </div>
          </div>

          {/* Context Badges */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>UC: <strong className="text-stone-900">{activeCatalog}.{activeSchema}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Lakehouse Live</span>
            </div>
          </div>
        </div>

        {/* Sub-Agents Toolbar */}
        <div className="mt-3 pt-2 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-medium text-stone-700 whitespace-nowrap mr-1">
            Sub-Agents:
          </span>
          {subAgents.map((agent) => {
            const isActive = activeSubAgent === agent.id;
            return (
              <button
                key={agent.id}
                id={`subagent-tab-${agent.id}`}
                onClick={() => onSelectSubAgent(agent.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-stone-900 text-white shadow-xs"
                    : "bg-stone-50 text-stone-600 hover:bg-stone-200 hover:text-stone-900 border border-stone-200"
                }`}
              >
                {agent.icon}
                <span>{agent.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
