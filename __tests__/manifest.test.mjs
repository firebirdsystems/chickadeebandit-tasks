import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });
});

// ── ai_access ─────────────────────────────────────────────────────────────────

describe("manifest.json ai_access", () => {
  const ai = manifest.ai_access;

  it("ai_access field is present", () => {
    expect(ai, "ai_access is required for this app").toBeDefined();
  });

  it("allowed is true", () => {
    expect(ai.allowed).toBe(true);
  });

  it("mode is read or read_write", () => {
    expect(["read", "read_write"]).toContain(ai.mode);
  });

  it("db_exports is an array of non-empty strings", () => {
    expect(Array.isArray(ai.db_exports)).toBe(true);
    expect(ai.db_exports.length).toBeGreaterThan(0);
    for (const name of ai.db_exports) {
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("each db_export name has a corresponding src/queries/{name}.sql file", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      expect(existsSync(path), `missing query file: src/queries/${name}.sql`).toBe(true);
    }
  });

  it("each query file starts with SELECT or WITH (no write statements)", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8").trim();
      expect(
        /^(SELECT|WITH)\b/i.test(sql),
        `src/queries/${name}.sql must start with SELECT or WITH, got: ${sql.slice(0, 40)}`
      ).toBe(true);
    }
  });

  it("each query file filters by household_id", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8");
      expect(
        sql.includes("household_id"),
        `src/queries/${name}.sql must filter by household_id to prevent cross-household data leaks`
      ).toBe(true);
    }
  });
});

// ── ai_access.db_mutations ────────────────────────────────────────────────────

describe("manifest.json ai_access.db_mutations", () => {
  const ai = manifest.ai_access;

  it("mode is read_write when db_mutations are declared", () => {
    if (!ai?.db_mutations?.length) return; // skip if no mutations declared
    expect(ai.mode).toBe("read_write");
  });

  it("db_mutations is an array of non-empty strings", () => {
    expect(Array.isArray(ai.db_mutations)).toBe(true);
    expect(ai.db_mutations.length).toBeGreaterThan(0);
    for (const name of ai.db_mutations) {
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("each db_mutation name has a corresponding src/mutations/{name}.sql file", () => {
    for (const name of ai.db_mutations) {
      const path = join(__dirname, `../src/mutations/${name}.sql`);
      expect(existsSync(path), `missing mutation file: src/mutations/${name}.sql`).toBe(true);
    }
  });

  it("each mutation file starts with UPDATE (no INSERT, DELETE, or SELECT)", () => {
    for (const name of ai.db_mutations) {
      const path = join(__dirname, `../src/mutations/${name}.sql`);
      const sql = readFileSync(path, "utf-8").trim();
      expect(
        /^UPDATE\b/i.test(sql),
        `src/mutations/${name}.sql must start with UPDATE, got: ${sql.slice(0, 40)}`
      ).toBe(true);
    }
  });

  it("each mutation file filters by household_id", () => {
    for (const name of ai.db_mutations) {
      const path = join(__dirname, `../src/mutations/${name}.sql`);
      const sql = readFileSync(path, "utf-8");
      expect(
        sql.includes("household_id"),
        `src/mutations/${name}.sql must filter by household_id to prevent cross-household data writes`
      ).toBe(true);
    }
  });
});

// ── ai_access SQL file validation ─────────────────────────────────────────────
if (manifest.ai_access) {
  const ai = manifest.ai_access;

  const SQL_TYPES = [
    { field: "db_exports",   dir: "queries",   keyword: /^(SELECT|WITH)\b/i, label: "SELECT or WITH" },
    { field: "db_mutations", dir: "mutations",  keyword: /^UPDATE\b/i,        label: "UPDATE"         },
    { field: "db_inserts",   dir: "inserts",    keyword: /^INSERT\b/i,        label: "INSERT"         },
    { field: "db_deletes",   dir: "deletes",    keyword: /^DELETE\b/i,        label: "DELETE"         },
  ];

  for (const { field, dir, keyword, label } of SQL_TYPES) {
    const names = ai[field] ?? [];
    if (names.length === 0) continue;

    describe(`ai_access.${field} SQL`, () => {
      it(`each name has a src/${dir}/{name}.sql file`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          expect(existsSync(path), `missing: src/${dir}/${name}.sql`).toBe(true);
        }
      });

      it(`each SQL file starts with ${label}`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8").trim();
          expect(keyword.test(sql), `src/${dir}/${name}.sql must start with ${label}, got: ${sql.slice(0, 50)}`).toBe(true);
        }
      });

      it(`each SQL file filters by household_id`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(sql.includes("household_id"), `src/${dir}/${name}.sql must filter by household_id`).toBe(true);
        }
      });

      it(`each SQL file is a single statement (no semicolons)`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(sql.includes(";"), `src/${dir}/${name}.sql must not contain semicolons`).toBe(false);
        }
      });
    });
  }

  if (ai.db_inserts?.length) {
    describe("ai_access.db_inserts schemas SQL", () => {
      it("each insert has a src/schemas/{name}.json file", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          expect(existsSync(path), `missing: src/schemas/${name}.json`).toBe(true);
        }
      });

      it("each schema file is valid JSON", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          expect(() => JSON.parse(readFileSync(path, "utf-8")), `src/schemas/${name}.json must be valid JSON`).not.toThrow();
        }
      });

      it("each schema declares type:array with an items definition", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          let schema;
          try { schema = JSON.parse(readFileSync(path, "utf-8")); } catch { continue; }
          expect(schema.type, `src/schemas/${name}.json must declare "type": "array"`).toBe("array");
          expect(
            Array.isArray(schema.items) || (typeof schema.items === "object" && schema.items !== null),
            `src/schemas/${name}.json must declare "items" to validate params`
          ).toBe(true);
        }
      });

      it("schema maxItems matches the number of $N placeholders in the SQL", () => {
        for (const name of ai.db_inserts) {
          const sqlPath    = join(__dirname, `../src/inserts/${name}.sql`);
          const schemaPath = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(sqlPath) || !existsSync(schemaPath)) continue;
          const sql = readFileSync(sqlPath, "utf-8");
          let schema;
          try { schema = JSON.parse(readFileSync(schemaPath, "utf-8")); } catch { continue; }
          const paramNums = [...sql.matchAll(/\$(\d+)/g)].map(m => parseInt(m[1], 10));
          const maxParam  = paramNums.length > 0 ? Math.max(...paramNums) : 0;
          expect(
            schema.maxItems,
            `src/schemas/${name}.json maxItems (${schema.maxItems}) must equal SQL $N count (${maxParam})`
          ).toBe(maxParam);
        }
      });
    });
  }
}
