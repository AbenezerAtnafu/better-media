export interface DrizzleDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface DrizzleDbConfig {
  provider: "pg" | "mysql" | "sqlite";
  /**
   * Set to true when your Drizzle table properties use snake_case (e.g. `mime_type`)
   * while better-media models use camelCase (e.g. `mimeType`).
   * The adapter will convert camelCase field names to snake_case before looking up columns.
   */
  camelCase?: boolean;
}
