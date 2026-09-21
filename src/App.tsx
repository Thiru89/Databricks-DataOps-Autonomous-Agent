import React, { useState } from "react";
import { Header } from "./components/Header";
import { AgentPromptBar } from "./components/AgentPromptBar";
import { MedallionDagVisualizer } from "./components/MedallionDagVisualizer";
import { OutputViewer } from "./components/OutputViewer";
import { LogAnalyzerLab } from "./components/LogAnalyzerLab";
import { WorkflowOrchestrator } from "./components/WorkflowOrchestrator";
import { SystemMonitoringHub } from "./components/SystemMonitoringHub";
import { PRESET_SCENARIOS } from "./data/sampleScenarios";
import {
  SubAgentType,
  PipelineContext,
  PresetScenario,
  StructuredSections,
} from "./types";
import { AlertCircle, Activity, Cpu, Layers } from "lucide-react";

export default function App() {
  const [activeSubAgent, setActiveSubAgent] = useState<SubAgentType>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [context, setContext] = useState<PipelineContext>({
    catalog: "ecommerce_prod",
    schema: "clickstream",
    storagePath: "abfss://lakehouse@storeadls.dfs.core.windows.net/events",
    sourceFormat: "json",
    clusterType: "autoscaling",
    slaMinutes: 15,
  });

  // Default to the first precomputed preset so the user sees immediate value without waiting!
  const defaultPreset = PRESET_SCENARIOS[0];
  const [currentSections, setCurrentSections] = useState<StructuredSections>(
    defaultPreset.precomputedResponse!.sections
  );
  const [rawOutput, setRawOutput] = useState<string>(
    `${defaultPreset.precomputedResponse!.sections.architecture}\n\n${defaultPreset.precomputedResponse!.sections.code}\n\n${defaultPreset.precomputedResponse!.sections.workflow}\n\n${defaultPreset.precomputedResponse!.sections.monitoring}`
  );

  const handleUpdateContext = (newCtx: Partial<PipelineContext>) => {
    setContext((prev) => ({ ...prev, ...newCtx }));
  };

  const parseSections = (text: string): StructuredSections => {
    const archMatch = text.match(/###?\s*1\.?\s*ARCHITECTURE[\s\S]*?(?=###?\s*2\.?\s*PRODUCTION|$)/i);
    const codeMatch = text.match(/###?\s*2\.?\s*PRODUCTION[\s\S]*?(?=###?\s*3\.?\s*DEPLOYMENT|$)/i);
    const workflowMatch = text.match(/###?\s*3\.?\s*DEPLOYMENT[\s\S]*?(?=###?\s*4\.?\s*MONITORING|$)/i);
    const monitoringMatch = text.match(/###?\s*4\.?\s*MONITORING[\s\S]*?$/i);

    if (archMatch || codeMatch || workflowMatch || monitoringMatch) {
      return {
        architecture: archMatch ? archMatch[0].trim() : "### 1. ARCHITECTURE & STRATEGY\n\nDesign summary generated.",
        code: codeMatch ? codeMatch[0].trim() : "### 2. PRODUCTION CODE & PIPELINE DEFINITION\n\nCode definition generated.",
        workflow: workflowMatch ? workflowMatch[0].trim() : "### 3. DEPLOYMENT & WORKFLOW SCRIPT\n\nWorkflow configuration generated.",
        monitoring: monitoringMatch ? monitoringMatch[0].trim() : "### 4. MONITORING & SELF-HEALING HOOKS\n\nMonitoring hooks generated.",
      };
    }

    return {
      architecture: text,
      code: "### 2. PRODUCTION CODE & PIPELINE DEFINITION\n\nCheck section 1 or ask for targeted code.",
      workflow: "### 3. DEPLOYMENT & WORKFLOW SCRIPT\n\nCheck section 1 or ask for targeted workflow.",
      monitoring: "### 4. MONITORING & SELF-HEALING HOOKS\n\nCheck section 1 or ask for targeted hooks.",
    };
  };

  const handleSelectPreset = (preset: PresetScenario) => {
    setErrorNotice(null);
    if (preset.context) {
      handleUpdateContext(preset.context);
    }
    setActiveSubAgent(preset.subAgent);

    if (preset.precomputedResponse) {
      setCurrentSections(preset.precomputedResponse.sections);
      setRawOutput(
        `${preset.precomputedResponse.sections.architecture}\n\n${preset.precomputedResponse.sections.code}\n\n${preset.precomputedResponse.sections.workflow}\n\n${preset.precomputedResponse.sections.monitoring}`
      );
    } else {
      // Trigger live generation for other presets
      handleGenerate(preset.prompt, {
        ...context,
        ...(preset.context as PipelineContext),
      });
    }
  };

  const handleGenerate = async (promptText: string, currentContext: PipelineContext) => {
    setIsLoading(true);
    setErrorNotice(null);

    try {
      const res = await fetch("/api/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          subAgent: activeSubAgent,
          context: currentContext,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (data.content) {
        setRawOutput(data.content);
        const parsed = parseSections(data.content);
        setCurrentSections(parsed);
      }
    } catch (err: any) {
      console.warn("Live Gemini API generation error:", err);
      setErrorNotice(
        err.message ||
          "Gemini API generation unavailable. Displaying production reference deliverable."
      );
      // Fall back to preset
      setCurrentSections(PRESET_SCENARIOS[0].precomputedResponse!.sections);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Global Header */}
      <Header
        activeSubAgent={activeSubAgent}
        onSelectSubAgent={setActiveSubAgent}
        activeCatalog={context.catalog}
        activeSchema={context.schema}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Error notification if any */}
        {errorNotice && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorNotice(null)}
              className="text-amber-900 font-bold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Prompt Bar & Scenario Switcher */}
        <AgentPromptBar
          onGenerate={handleGenerate}
          isLoading={isLoading}
          activeSubAgent={activeSubAgent}
          context={context}
          onUpdateContext={handleUpdateContext}
          presets={PRESET_SCENARIOS}
          onSelectPreset={handleSelectPreset}
        />

        {/* Sub-Agent Context Views */}
        {activeSubAgent === "monitoring" || activeSubAgent === "remediation" ? (
          <LogAnalyzerLab />
        ) : activeSubAgent === "orchestration" ? (
          <WorkflowOrchestrator catalog={context.catalog} schema={context.schema} />
        ) : (
          <MedallionDagVisualizer catalog={context.catalog} schema={context.schema} />
        )}

        {/* 4-Section Output Viewer */}
        <OutputViewer
          sections={currentSections}
          rawContent={rawOutput}
          catalog={context.catalog}
          schema={context.schema}
        />

        {/* System Monitoring & Telemetry Hub */}
        <div className="mt-8">
          <SystemMonitoringHub catalog={context.catalog} schema={context.schema} />
        </div>

        {/* Dedicated Workbench Toggles for Ops Teams */}
        {activeSubAgent !== "monitoring" && activeSubAgent !== "remediation" && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                DataOps Failure & RCA Diagnostic Workbench:
              </h4>
            </div>
            <LogAnalyzerLab />
          </div>
        )}

        {activeSubAgent !== "orchestration" && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Lakeflow Cluster Sizing & Jobs API Sizer:
              </h4>
            </div>
            <WorkflowOrchestrator catalog={context.catalog} schema={context.schema} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-700 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Databricks Lakehouse DataOps Autonomous Agent</span>
            <span>•</span>
            <span>Delta Live Tables & Unity Catalog</span>
          </div>
          <div>
            Built strictly adhering to Databricks Lakehouse Medallion & 4-Section Output conventions.
          </div>
        </div>
      </footer>
    </div>
  );
}
