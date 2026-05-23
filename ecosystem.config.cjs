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
        PORT: "3001",
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
