export type HadesStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface HadesJobDetail {
  jobId: string;
  status: HadesStatus;
  currentModule: string | null;
  modulesCompleted: string[];
  errorMessage: string | null;
}

export interface RunRequest {
  spec: unknown;
  cdmSchema: string;
  envName: string;
  name: string;
}
