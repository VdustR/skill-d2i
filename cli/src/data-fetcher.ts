import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

const TARBALL_URL = "https://github.com/blizzhackers/d2data/archive/refs/heads/master.tar.gz";
const CACHE_DIR = path.join(os.homedir(), ".cache", "game-d2i-skills", "d2data");

export type DataFileName = `${string}.json`;

export async function setup(): Promise<{ cached: string[]; totalSize: number }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "d2data-"));
  const tmpTarball = path.join(tmpDir, "d2data.tar.gz");

  try {
    process.stderr.write("Downloading d2data tarball...\n");
    execFileSync("curl", ["-fsSL", "-o", tmpTarball, TARBALL_URL], { timeout: 120000 });

    process.stderr.write("Extracting...\n");
    execFileSync("tar", ["-xzf", tmpTarball, "-C", tmpDir], { timeout: 60000 });

    // Find the extracted top-level directory (e.g., d2data-master/)
    const topDirs = fs.readdirSync(tmpDir).filter((d) =>
      fs.statSync(path.join(tmpDir, d)).isDirectory()
    );
    if (topDirs.length === 0) {
      throw new Error("Extracted tarball contains no top-level directory");
    }
    const jsonDir = path.join(tmpDir, topDirs[0], "json");

    const cached: string[] = [];
    let totalSize = 0;

    for (const file of fs.readdirSync(jsonDir).filter((f) => f.endsWith(".json"))) {
      const src = path.join(jsonDir, file);
      const dest = path.join(CACHE_DIR, file);
      fs.copyFileSync(src, dest);
      const size = fs.statSync(dest).size;
      totalSize += size;
      cached.push(file);
    }

    // Write metadata
    fs.writeFileSync(
      path.join(CACHE_DIR, "_meta.json"),
      JSON.stringify({ fetchedAt: new Date().toISOString(), files: cached })
    );

    process.stderr.write(`Cached ${cached.length} files (${(totalSize / 1024).toFixed(0)}KB)\n`);
    return { cached, totalSize };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function isCached(): boolean {
  return fs.existsSync(path.join(CACHE_DIR, "_meta.json"));
}

export function getCacheDir(): string {
  return CACHE_DIR;
}

const _dataCache = new Map<string, any>();
export function loadData(file: DataFileName): any {
  const cached = _dataCache.get(file);
  if (cached) return cached;
  const filePath = path.join(CACHE_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data not cached. Run with --setup first.`);
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    _dataCache.set(file, data);
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Cached file ${file} is corrupt. Re-run with --setup.`);
    }
    throw err;
  }
}
