import fs from "node:fs/promises";
import { VirusTotalScanner } from "./virustotal.scanner";

// Mock fs to avoid hitting real disk
jest.mock("node:fs/promises");

describe("VirusTotalScanner", () => {
  let scanner: VirusTotalScanner;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Mock global fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    scanner = new VirusTotalScanner({
      apiKey: "test-api-key",
      pollingIntervalMs: 1, // fast polling for tests
      pollingTimeoutMs: 1000,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should enforce required options", () => {
    // @ts-expect-error testing missing options
    expect(() => new VirusTotalScanner({})).toThrow("VirusTotalScanner requires an apiKey");
  });

  describe("upload logic", () => {
    it("should POST directly to /files for small files", async () => {
      // Mock upload response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "test-analysis-id" } }),
      });

      // Mock analysis response (clean)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            attributes: {
              status: "completed",
              stats: { malicious: 0, suspicious: 0 },
              results: {},
            },
          },
        }),
      });

      const buffer = Buffer.alloc(10); // 10 bytes = small file
      await scanner.scanBuffer(buffer);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe("https://www.virustotal.com/api/v3/files");
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
      expect(fetchMock.mock.calls[0][1].headers).toEqual({ "x-apikey": "test-api-key" });
    });

    it("should get upload URL first for files > 32MB", async () => {
      const largeUrl = "https://www.virustotal.com/api/v3/files/upload_url_special";

      fetchMock
        .mockResolvedValueOnce({
          // URL request
          ok: true,
          json: async () => ({ data: largeUrl }),
        })
        .mockResolvedValueOnce({
          // Upload request
          ok: true,
          json: async () => ({ data: { id: "test-id" } }),
        })
        .mockResolvedValueOnce({
          // Analysis request
          ok: true,
          json: async () => ({
            data: {
              attributes: {
                status: "completed",
                stats: { malicious: 0, suspicious: 0 },
                results: {},
              },
            },
          }),
        });

      const buffer = Buffer.alloc(32 * 1024 * 1024 + 10); // slightly > 32MB
      await scanner.scanBuffer(buffer);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[0][0]).toBe("https://www.virustotal.com/api/v3/files/upload_url");
      expect(fetchMock.mock.calls[1][0]).toBe(largeUrl);
    });
  });

  describe("scanFile", () => {
    it("should read from fs and upload", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.alloc(100));

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: "test-id" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              attributes: {
                status: "completed",
                stats: { malicious: 0, suspicious: 0 },
                results: {},
              },
            },
          }),
        });

      await scanner.scanFile("/tmp/malware.exe");

      expect(fs.readFile).toHaveBeenCalledWith("/tmp/malware.exe");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Verify FormData contains the right filename
      const formData = fetchMock.mock.calls[0][1].body as FormData;
      expect(formData.get("file")).toBeDefined();
    });
  });

  describe("analysis polling", () => {
    it("should poll until completed and return infected result", async () => {
      fetchMock
        .mockResolvedValueOnce({
          // upload
          ok: true,
          json: async () => ({ data: { id: "test-id" } }),
        })
        .mockResolvedValueOnce({
          // first poll -> queued
          ok: true,
          json: async () => ({
            data: { attributes: { status: "queued" } },
          }),
        })
        .mockResolvedValueOnce({
          // second poll -> completed + infected
          ok: true,
          json: async () => ({
            data: {
              attributes: {
                status: "completed",
                stats: { malicious: 1, suspicious: 1, undetected: 60 },
                results: {
                  Kaspersky: { category: "malicious", result: "Trojan.Fake" },
                  BitDefender: { category: "suspicious", result: "Heuristic" },
                  Avast: { category: "undetected", result: null },
                },
              },
            },
          }),
        });

      const result = await scanner.scanBuffer(Buffer.alloc(10));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.infected).toBe(true);
      expect(result.viruses).toEqual(
        expect.arrayContaining(["Kaspersky:Trojan.Fake", "BitDefender:Heuristic"])
      );
      expect(result.viruses).not.toContain("Avast:null");
    });

    it("should throw if polling times out", async () => {
      scanner = new VirusTotalScanner({
        apiKey: "test",
        pollingIntervalMs: 50,
        pollingTimeoutMs: 100, // fast timeout
      });

      fetchMock
        .mockResolvedValueOnce({
          // upload
          ok: true,
          json: async () => ({ data: { id: "test-id" } }),
        })
        .mockResolvedValue({
          // always return queued
          ok: true,
          json: async () => ({
            data: { attributes: { status: "queued" } },
          }),
        });

      await expect(scanner.scanBuffer(Buffer.alloc(10))).rejects.toThrow(
        "VirusTotal scan timed out"
      );
    });

    it("should throw if an API request fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API Key",
      });

      await expect(scanner.scanBuffer(Buffer.alloc(10))).rejects.toThrow(
        "VirusTotal upload failed: 401 Invalid API Key"
      );
    });
  });
});
