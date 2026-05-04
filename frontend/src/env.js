import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    INTERNAL_BACKEND_URL: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    INTERNAL_BACKEND_URL: process.env.INTERNAL_BACKEND_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
