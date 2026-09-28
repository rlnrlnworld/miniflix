import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI(migrate)는 pooler 아닌 direct 연결 필요
    url: process.env["DIRECT_URL"],
  },
});
