module.exports = {
  apps: [
    {
      name: "jakbarber",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "450M",
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
