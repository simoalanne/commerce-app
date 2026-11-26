import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: "unit", include: ["src/**/*.unit.test.ts"] },
      },
      {
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
