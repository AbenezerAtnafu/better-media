/**
 * Job adapter interface for background execution.
 * Implementations: in-memory (default), Redis, RabbitMQ, Kafka, etc.
 */
export interface JobAdapter {
  /** Enqueue a job for background execution */
  enqueue(name: string, payload: Record<string, unknown>): Promise<void>;
}
