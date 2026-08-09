import { readFileSync, existsSync, readdirSync } from "fs";
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

  // A private list is readable through the owner arm of owner_or_visibility and
  // nothing else — this policy grants no adult tier, so once the owner is off
  // the roster no member, adult or admin, has a path to the row. Clearing the
  // owner (the previous "null") made that permanent: the list and every task in
  // it stayed in the database, exported and billed, visible to nobody. Only the
  // private rows are deleted; a `visibility = 'everyone'` list is shared work
  // that must survive whoever created it, and it stays readable and writable by
  // the household with a stale owner id, so it needs no action at all.
  //
  // No dependent_tables on purpose: the app already renders a task whose
  // list_id names a row that no longer exists (src/index.html — the list tag is
  // conditional on finding the list), so the tasks survive as unassigned rather
  // than being destroyed along with a list they merely sat in.
  it("deletes only the unreachable private lists on member removal", () => {
    expect(manifest.member_references?.lists).toEqual({
      column: "member_id",
      on_removed: "delete",
      only_when: { column: "visibility", values: ["private"] },
    });
  });

  it("only ever writes the two list visibility values only_when relies on", () => {
    const html = readFileSync(join(__dirname, "../src/index.html"), "utf-8");
    expect(html).toMatch(/visibility\s*===?\s*"everyone"\s*\?\s*"everyone"\s*:\s*"private"/);
  });

  it("enforces member ownership and keeps due dates queryable", () => {
    expect(manifest.row_policies?.lists).toEqual({
      kind: "owner_or_visibility",
      member_column: "member_id",
      visibility_column: "visibility",
      everyone_values: ["everyone"],
      write_visibility_scoped: true,
    });
    expect(manifest.row_policies?.tasks).toEqual({
      kind: "owner_only",
      member_column: "assignee_id",
      retain_days: {
        default: 365,
        timestamp_column: "completed_at",
        override_key: "completed_tasks",
        // A completed task is tidy-up, not a family record, so a record-mode
        // space (co-parenting) leaves this window alone instead of applying its
        // seven-year evidentiary floor.
        tier: "operational",
      },
    });
    expect(manifest.db_plaintext_columns).toContain("due_date");
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

});

describe("D1 compatibility", () => {
  it("does not use PostgreSQL UUID functions", () => {
    const sql = readFileSync(join(__dirname, "../src/inserts/add_task.sql"), "utf-8");
    expect(sql).not.toMatch(/gen_random_uuid/i);
    expect(sql).toMatch(/randomblob/i);
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

// ── automation_actions ↔ migrations ──────────────────────────────────────────
//
// The hub validates automation steps for identifier hygiene and for unresolved
// `:param` references, but it never compares them against this app's schema. A
// renamed column or a missing NOT NULL value would therefore surface only when
// a rule fires in a real household, as a failed run in someone's history. These
// tests are that missing check.

const AUTOMATION_PREFIX = `app_${manifest.id.replace(/-/g, "_")}__`;

function migrationSchema() {
  const dir = join(__dirname, "../migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf-8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");

  const tables = {};
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
  for (let m; (m = createRe.exec(sql)); ) {
    const cols = {};
    for (const raw of m[2].split("\n")) {
      const line = raw.trim().replace(/,$/, "");
      const name = line.split(/\s+/)[0];
      if (!name || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(name)) continue;
      cols[name] = {
        notNull: /NOT\s+NULL/i.test(line) || /PRIMARY\s+KEY/i.test(line),
        hasDefault: /DEFAULT/i.test(line),
      };
    }
    tables[m[1]] = cols;
  }
  const alterRe = /ALTER\s+TABLE\s+([A-Za-z_]\w*)\s+ADD\s+COLUMN\s+([A-Za-z_]\w*)([^;]*);/gi;
  for (let m; (m = alterRe.exec(sql)); ) {
    if (tables[m[1]]) {
      tables[m[1]][m[2]] = { notNull: /NOT\s+NULL/i.test(m[3]), hasDefault: /DEFAULT/i.test(m[3]) };
    }
  }
  return tables;
}

describe.skipIf(!manifest.automation_actions)("automation_actions match the migrations", () => {
  const schema = migrationSchema();
  const table = (name) => schema[`${AUTOMATION_PREFIX}${name}`];
  const actions = Object.entries(manifest.automation_actions ?? {});

  for (const [actionId, action] of actions) {
    describe(actionId, () => {
      it("every step names a table this app actually has", () => {
        for (const step of action.steps) {
          expect(table(step.table), `unknown table: ${step.table}`).toBeTruthy();
        }
      });

      it("every referenced column exists", () => {
        for (const step of action.steps) {
          const cols = table(step.table) ?? {};
          const referenced = [
            ...Object.keys(step.values ?? {}),
            ...Object.keys(step.set ?? {}),
            ...Object.keys(step.where ?? {}),
            ...Object.values(step.bind ?? {}),
          ];
          for (const col of referenced) {
            expect(cols[col], `${step.table}.${col} is not in the migrations`).toBeTruthy();
          }
        }
      });

      it("inserts supply every column that is NOT NULL without a default", () => {
        for (const step of action.steps) {
          if (step.op !== "insert") continue;
          const cols = table(step.table) ?? {};
          for (const [col, spec] of Object.entries(cols)) {
            if (!spec.notNull || spec.hasDefault) continue;
            expect(
              step.values[col],
              `${step.table}.${col} is NOT NULL with no default, so the insert must set it`,
            ).toBeTruthy();
          }
        }
      });

      it("the dedupe column exists and is plaintext", () => {
        if (!action.dedupe) return;
        const cols = table(action.dedupe.table) ?? {};
        expect(cols[action.dedupe.column], `unknown dedupe column: ${action.dedupe.column}`).toBeTruthy();
        // The guard matches with `WHERE col = ?`. Encryption uses a random IV,
        // so an encrypted column would never match and every event would apply
        // twice — silently. Plaintext is by suffix convention or declaration.
        const plain =
          manifest.db_encryption === "off" ||
          /(_id|_at|_date|_by)$/.test(action.dedupe.column) ||
          (manifest.db_plaintext_columns ?? []).includes(action.dedupe.column);
        expect(plain, `${action.dedupe.column} would be encrypted at rest`).toBe(true);
      });

      it("lookup WHERE columns are plaintext", () => {
        for (const step of action.steps) {
          if (step.op === "insert") continue;
          for (const col of Object.keys(step.where ?? {})) {
            const plain =
              manifest.db_encryption === "off" ||
              /(_id|_at|_date|_by)$/.test(col) ||
              (manifest.db_plaintext_columns ?? []).includes(col);
            expect(plain, `${step.table}.${col} is compared in SQL but would be encrypted`).toBe(true);
          }
        }
      });
    });
  }

  it("suggestions that target this app name a declared action", () => {
    for (const s of manifest.suggested_automations ?? []) {
      if (s.target_app_id !== manifest.id) continue;
      expect(manifest.automation_actions[s.action_id], `unknown action: ${s.action_id}`).toBeTruthy();
    }
  });

  it("suggestions map every required param of the action they target", () => {
    for (const s of manifest.suggested_automations ?? []) {
      if (s.target_app_id !== manifest.id) continue;
      const params = manifest.automation_actions[s.action_id].params;
      for (const [name, spec] of Object.entries(params)) {
        if (!spec.required) continue;
        expect(s.param_map?.[name], `"${s.title}" does not map required param "${name}"`).toBeTruthy();
      }
    }
  });
});

// ── retention ────────────────────────────────────────────────────────────────
//
// The hub refuses a `retain_days` declaration whose timestamp column has no
// index LEADING with it, and it refuses one whose columns are missing from the
// migrations. Both failures land at install/publish time rather than in review,
// so they are asserted here.

describe("retain_days matches the migrations", () => {
  const retain = manifest.row_policies.tasks.retain_days;
  const schema = migrationSchema();
  const rawSql = readdirSync(join(__dirname, "../migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(__dirname, "../migrations", f), "utf-8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");

  it("prunes on a column the table actually has", () => {
    expect(schema[`${AUTOMATION_PREFIX}tasks`][retain.timestamp_column]).toBeTruthy();
  });

  it("has an index beginning with the timestamp column", () => {
    const re = new RegExp(
      `create\\s+(?:unique\\s+)?index[\\s\\S]*?on\\s+${AUTOMATION_PREFIX}tasks\\s*\\(\\s*${retain.timestamp_column}`,
      "i",
    );
    expect(re.test(rawSql)).toBe(true);
  });

  it("prunes on completion, not creation — an open task has no completed_at", () => {
    // `WHERE completed_at < ?` never matches NULL, which is what keeps the
    // sweep off tasks that were never finished, however old they are.
    expect(retain.timestamp_column).toBe("completed_at");
    expect(schema[`${AUTOMATION_PREFIX}tasks`].completed_at.notNull).toBe(false);
  });
});
