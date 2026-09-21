import React, { useState } from "react";
import { Send, Settings, Sparkles, Database, Loader2 } from "lucide-react";
import { SubAgentType, PipelineContext, PresetScenario } from "../types";

interface AgentPromptBarProps {
  onGenerate: (prompt: string, context: PipelineContext) => void;
  isLoading: boolean;
  activeSubAgent: SubAgentType;
  context: PipelineContext;
  onUpdateContext: (context: Partial<PipelineContext>) => void;
  presets: PresetScenario[];
  onSelectPreset: (preset: PresetScenario) => void;
}

export const AgentPromptBar: React.FC<AgentPromptBarProps> = ({
  onGenerate,
  isLoading,
  activeSubAgent,
  context,
  onUpdateContext,
  presets,
  onSelectPreset,
}) => {
  const [prompt, setPrompt] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt, context);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-5 mb-6">
      {/* Preset Scenario Quick-Run Buttons */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Ready-to-Deploy Databricks Lakehouse Scenarios:</span>
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-stone-700 hover:text-stone-900 flex items-center gap-1 cursor-pointer font-medium"
          >
            <Settings className="w-3.5 h-3.5 text-stone-600" />
            <span>{showSettings ? "Hide Parameters" : "Edit UC Parameters"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              id={`preset-${p.id}`}
              onClick={() => {
                setPrompt(p.prompt);
                onSelectPreset(p);
              }}
              className="text-left p-2.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-stone-300 transition-all cursor-pointer group"
            >
              <div className="font-semibold text-xs text-stone-900 group-hover:text-red-700 transition-colors flex items-center justify-between">
                <span>{p.title}</span>
                <span className="text-[10px] uppercase font-bold text-stone-600 px-1 rounded bg-stone-200/60">
                  {p.subAgent}
                </span>
              </div>
              <p className="text-[11px] text-stone-700 line-clamp-1 mt-0.5">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Unity Catalog Context Drawer */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs">
          <div className="font-semibold text-stone-900 mb-2 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Unity Catalog & Storage Parameters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-stone-700 font-medium mb-1">Catalog Name:</label>
              <input
                type="text"
                value={context.catalog}
                onChange={(e) => onUpdateContext({ catalog: e.target.value })}
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded-md border border-stone-300 bg-white"
                placeholder="e.g. main / prod"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-medium mb-1">Schema / Database:</label>
              <input
                type="text"
                value={context.schema}
                onChange={(e) => onUpdateContext({ schema: e.target.value })}
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded-md border border-stone-300 bg-white"
                placeholder="e.g. clickstream"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-stone-700 font-medium mb-1">Landing Storage Path:</label>
              <input
                type="text"
                value={context.storagePath}
                onChange={(e) => onUpdateContext({ storagePath: e.target.value })}
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded-md border border-stone-300 bg-white"
                placeholder="e.g. abfss://... or s3://..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe your Databricks Lakehouse pipeline requirement, Auto Loader format, DLT expectations, or troubleshooting scenario..."
          className="w-full p-3.5 pr-28 rounded-lg border border-stone-300 text-xs sm:text-sm text-stone-900 placeholder:text-stone-600 focus:outline-hidden focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Generate Pipeline</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
