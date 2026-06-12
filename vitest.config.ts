import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The build (tsc) emits src/*.js next to src/*.ts; make sure tests
    // resolve extensionless imports to the TypeScript sources, not the
    // compiled output (Vite's default order prefers ".js" over ".ts").
    extensions: [".ts", ".mjs", ".js", ".mts", ".jsx", ".tsx", ".json"]
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"]
  }
});
