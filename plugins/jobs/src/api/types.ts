export type HadesStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface HadesJob {
  jobId: string;
  status: HadesStatus;
  pid: number | null;
  currentModule: string | null;
  modulesCompleted: string[];
  elapsedMs: number;
  errorMessage: string | null;
  envName: string;
  databaseName: string;
}

export interface HadesJobDetail extends HadesJob {
  logTail: string[];
}

export interface HadesEnv {
  envName: string;
  path: string;
}

export interface RunRequest {
  spec: unknown;       // Strategus AnalysisSpecification JSON
  cdmSchema: string;
  envName: string;
  name?: string;
}
