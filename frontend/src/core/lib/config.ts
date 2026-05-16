import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface AppConfig {
  backend_url: string;
  backend_ws_url: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), "config.yaml");

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.yaml not found at ${CONFIG_PATH}. Copy config-example.yaml to config.yaml and adjust values.`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed = yaml.load(raw) as Partial<AppConfig>;

  if (!parsed.backend_url) {
    throw new Error("config.yaml is missing required field: backend_url");
  }

  cached = {
    backend_url: parsed.backend_url.replace(/\/+$/, ""),
    backend_ws_url: parsed.backend_ws_url?.replace(/\/+$/, "") ?? parsed.backend_url.replace(/^http/, "ws").replace(/\/+$/, ""),
  };

  return cached;
}
