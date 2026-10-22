import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    test: {
      globals: true,
      environment: "node",
      testTimeout: 20_000,
      hookTimeout: 30_000,
      env: {
        ...env,
        // API tests write rows (audit log is append-only), so prefer a dedicated DB if you have one.
        DATABASE_URL: env.TEST_DATABASE_URL || env.DATABASE_URL,
        JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET || "test-access-secret-0123456789abcdef",
        JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET || "test-refresh-secret-0123456789abcdef",
      },
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
