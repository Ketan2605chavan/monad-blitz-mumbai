// PM2 Ecosystem Config — manages both frontend and agent
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "defi-copilot-frontend",
      cwd: "./frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
      merge_logs: true,
    },
    {
      name: "defi-copilot-agent",
      cwd: "./agent",
      script: "dist/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "../logs/agent-error.log",
      out_file: "../logs/agent-out.log",
      merge_logs: true,
      // Restart delay to avoid hammering RPC on repeated crashes
      restart_delay: 5000,
    },
  ],
};
