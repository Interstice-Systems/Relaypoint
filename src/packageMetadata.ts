import { readFileSync } from "node:fs";

interface PackageMetadata {
  version?: unknown;
}

function readPackageVersion(): string {
  const packagePath = new URL("../package.json", import.meta.url);
  const metadata = JSON.parse(readFileSync(packagePath, "utf8")) as PackageMetadata;
  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("package.json does not contain a valid version.");
  }
  return metadata.version;
}

export const PACKAGE_VERSION = readPackageVersion();
