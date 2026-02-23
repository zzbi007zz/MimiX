module.exports = {
  apps: [
    {
      name: "mimi-bot",
      script: "bun",
      args: "run src/index.ts",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/mimi-error.log",
      out_file: "./logs/mimi-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "camofox",
      script: "npm",
      args: "start",
      cwd: process.env.HOME + "/.camofox",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "./logs/camofox-error.log",
      out_file: "./logs/camofox-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
