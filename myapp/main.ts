import { Database } from "jsr:@db/sqlite@0.11";
import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

let db: Database;

try {
  db = new Database("horses.db");
  console.log("Database opened successfully.");
  // Ensure the table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS horses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      permalink TEXT NOT NULL
    )
  `);
  console.log("Horses table created or already exists.");
} catch (error) {
  console.error("Error setting up database:", (error as Error).message);
  Deno.exit(1);
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

type Horse = {
  id: number;
  name: string;
  age: number;
  permalink: string;
};

await serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const id = path.split("/")[2];

  if (!path.startsWith("/horse")) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    if (req.method === "GET" && !id) {
      const horses = db.prepare("SELECT * FROM horses").all() as Horse[];
      return new Response(JSON.stringify(horses), {
        headers: { "Content-Type": "application/json" },
        status: horses.length ? 200 : 404,
      });
    }

    if (req.method === "GET" && id) {
      const horse = db.prepare("SELECT * FROM horses WHERE id = ?").get(id) as Horse | undefined;
      if (!horse) {
        return new Response("Horse not found", { status: 404 });
      }
      return new Response(JSON.stringify(horse), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (req.method === "POST") {
      const { name, age } = await req.json();
      const permalink = "horsetider.dev/" + toKebabCase(name);
      db.prepare("INSERT INTO horses (name, age, permalink) VALUES (?, ?, ?)").run(name, age, permalink);
      const horse = db.prepare("SELECT * FROM horses WHERE rowid = last_insert_rowid()").get() as Horse;
      return new Response(JSON.stringify(horse), {
        headers: { "Content-Type": "application/json" },
        status: 201,
      });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (error) {
    console.error("Error processing request:", (error as Error).message);
    return new Response("Internal Server Error", { status: 500 });
  }
});
