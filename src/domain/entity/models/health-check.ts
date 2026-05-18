export type HealthStatus = "ok";

export interface HealthCheckPayload extends Record<string, unknown> {
  status: HealthStatus;
  serverName: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}
