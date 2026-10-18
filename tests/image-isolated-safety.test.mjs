import test from "node:test";
import assert from "node:assert/strict";
import { validateImageIsolatedEnvironment } from "./image-isolated.mjs";

const valid = {
  CONTENTOS_ISOLATED_BRANCH: "br-divine-term-b2rihbxv",
  DATABASE_URL: "postgresql://synthetic:placeholder@ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=require&channel_binding=require"
};

test("isolated image integration permits only the verified Neon branch with provider credentials absent", () => {
  assert.doesNotThrow(() => validateImageIsolatedEnvironment(valid));
  assert.doesNotThrow(() => validateImageIsolatedEnvironment({ ...valid, DATABASE_URL: valid.DATABASE_URL.replace("-pooler", "") }));
  for (const patch of [{ CONTENTOS_ISOLATED_BRANCH: undefined }, { CONTENTOS_ISOLATED_BRANCH: "other" },
    { DATABASE_URL: valid.DATABASE_URL.replace("ep-proud-field-b291xbnc-pooler", "production") },
    { DATABASE_URL: valid.DATABASE_URL.replace("/contentos?", "/other?") },
    { DATABASE_URL: valid.DATABASE_URL.replace("postgresql:", "https:") },
    { DATABASE_URL: valid.DATABASE_URL.replace("sslmode=require", "sslmode=disable") },
    { DATABASE_URL: `${valid.DATABASE_URL}&host=production.invalid` }, { DATABASE_URL: "invalid secret value" },
    { DATABASE_URL: `${valid.DATABASE_URL}&sslmode=disable` },
    { OPENAI_API_KEY: "forbidden" }, { STRIPE_SECRET_KEY: "forbidden" }, { RESEND_API_KEY: "forbidden" }
  ]) assert.throws(() => validateImageIsolatedEnvironment({ ...valid, ...patch }), { message: "Isolated database configuration rejected." });
});
