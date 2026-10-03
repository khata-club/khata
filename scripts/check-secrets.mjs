import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const artifacts = {
  "linux-x64":
    "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  "linux-arm64":
    "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  "darwin-arm64":
    "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  "darwin-x64":
    "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
};
const platform = `${process.platform}-${process.arch}`;
const digest = artifacts[platform];
if (!digest)
  throw new Error(`No reviewed secret-scanner binary for ${platform}`);
const temp = mkdtempSync(join(tmpdir(), "khata-secret-scan-"));
try {
  const asset = `gitleaks_8.30.1_${process.platform}_${process.arch}.tar.gz`;
  const response = await fetch(
    `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/${asset}`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok)
    throw new Error(`Secret-scanner download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== digest)
    throw new Error("Secret-scanner checksum mismatch");
  const archive = join(temp, "scanner.tgz");
  writeFileSync(archive, bytes);
  execFileSync("tar", ["-xzf", archive, "-C", temp, "gitleaks"]);
  const binary = join(temp, "gitleaks");
  if (process.argv.includes("--history")) {
    execFileSync(binary, ["git", "--no-banner", "--redact", "."], {
      stdio: "inherit",
    });
  } else {
    // Include reviewable uncommitted files, excluding ignored local secrets and dependencies.
    const selected = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean);
    const source = join(temp, "source");
    mkdirSync(source);
    for (const file of selected) {
      const target = join(source, file);
      mkdirSync(dirname(target), { recursive: true });
      try {
        copyFileSync(file, target);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    execFileSync(binary, ["dir", "--no-banner", "--redact", source], {
      stdio: "inherit",
    });
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
