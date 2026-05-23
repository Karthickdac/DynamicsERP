const fs = require("fs");
const path = require("path");

// Load .env file from project root if it exists.
// This file is gitignored and must be created manually on the server.
const envFilePath = path.join(__dirname, ".env");
const serverEnv = {};
if (fs.existsSync(envFilePath)) {
  const lines = fs.readFileSync(envFilePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    serverEnv[key] = value;
  }
}

module.exports = {
  apps: [
    {
      name: "dge-erp",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: "/home/dynamicgreenenergy-erp/htdocs/erp.dynamicgreenenergy.in",
      instances: 1,
      exec_mode: "fork",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      env_production: {
        NODE_ENV: "production",
        PORT: "8000",
        ...serverEnv,
      },
      error_file: "/var/log/dge-erp/error.log",
      out_file: "/var/log/dge-erp/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
    },
  ],
};
