import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.unit.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          setupFiles: ["./src/tests/setup.ts"],
          globalSetup: ["./src/tests/globalSetup.ts"],
        },
      },
    ],
  },
});
