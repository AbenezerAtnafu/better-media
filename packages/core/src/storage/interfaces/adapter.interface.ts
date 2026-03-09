export interface StorageAdapter {
  get(key: string): Promise<Buffer | null>;
  put(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
}
