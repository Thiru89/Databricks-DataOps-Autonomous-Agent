export type SubAgentType = "all" | "ingestion" | "orchestration" | "monitoring" | "remediation";

export type OutputSectionKey = "architecture" | "code" | "workflow" | "monitoring";

export interface PipelineContext {
  catalog: string;
  schema: string;
  storagePath: string;
  sourceFormat: "json" | "parquet" | "csv" | "delta" | "kafka";
  clusterType: "serverless" | "single_node" | "autoscaling";
  slaMinutes: number;
}

export interface StructuredSections {
  architecture: string;
  code: string;
  workflow: string;
  monitoring: string;
}

export interface PresetScenario {
  id: string;
  title: string;
  description: string;
  subAgent: SubAgentType;
  prompt: string;
  tags: string[];
  context: Partial<PipelineContext>;
  precomputedResponse?: {
    raw: string;
    sections: StructuredSections;
  };
}

export interface RCAResult {
  failure_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  is_transient: boolean;
  root_cause: string;
  affected_component: string;
  self_healing_patch: string;
  prevention_strategy: string;
  system_tables_diagnostic_query: string;
  pr_title?: string;
  pr_description?: string;
}

export interface LogSample {
  id: string;
  title: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  snippet: string;
}

export interface MedallionNode {
  id: string;
  layer: "bronze" | "silver" | "quarantine" | "gold";
  tableName: string;
  format: string;
  recordsPerSec: number;
  qualityExpectations: string[];
  quarantinedCount?: number;
  clusterBy?: string[];
}
