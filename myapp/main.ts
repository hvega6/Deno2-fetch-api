import { Database } from "jsr:@db/sqlite@0.11"; // Importing Database from SQLite
import { serve } from "https://deno.land/std@0.140.0/http/server.ts"; // Importing serve function for HTTP server

let db: Database; // Declaring a variable to hold the database instance

try {
  db = new Database("horses.db"); // Initializing the database with the specified file
  console.log("Database opened successfully."); // Logging successful database opening
  // Ensure the table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS horses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, // Unique identifier for each horse
      name TEXT NOT NULL, // Name of the horse
      age INTEGER NOT NULL, // Age of the horse
      permalink TEXT NOT NULL // URL-friendly version of the horse's name
    )
  `);
  console.log("Horses table created or already exists."); // Logging table creation or existence
} catch (error) {
  console.error("Error setting up database:", (error as Error).message); // Logging any errors during setup
  Deno.exit(1); // Exiting the application if there's an error
}

// Function to convert a string to kebab-case
function toKebabCase(str: string): string {
  return str
    .toLowerCase() // Convert string to lowercase
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove any non-alphanumeric characters except hyphens
}

type Horse = {
  id: number; // Horse ID
  name: string; // Horse name
  age: number; // Horse age
  permalink: string; // Horse permalink
};

// Start serving HTTP requests
await serve(async (req: Request) => {
  const url = new URL(req.url); // Parse the request URL
  const path = url.pathname; // Get the path from the URL
  const id = path.split("/")[2]; // Extract the horse ID from the path

  // Check if the path starts with "/horse"
  if (!path.startsWith("/horse")) {
    return new Response("Not Found", { status: 404 }); // Return 404 if path is not found
  }

  try {
    // Handle GET request for all horses
    if (req.method === "GET" && !id) {
      const horses = db.prepare("SELECT * FROM horses").all() as Horse[]; // Fetch all horses from the database
      return new Response(JSON.stringify(horses), { // Return the list of horses as JSON
        headers: { "Content-Type": "application/json" }, // Set content type to JSON
        status: horses.length ? 200 : 404, // Return 200 if horses exist, otherwise 404
      });
    }

    // Handle GET request for a specific horse by ID
    if (req.method === "GET" && id) {
      const horse = db.prepare("SELECT * FROM horses WHERE id = ?").get(id) as Horse | undefined; // Fetch horse by ID
      if (!horse) {
        return new Response("Horse not found", { status: 404 }); // Return 404 if horse not found
      }
      return new Response(JSON.stringify(horse), { // Return the horse details as JSON
        headers: { "Content-Type": "application/json" }, // Set content type to JSON
        status: 200, // Return 200 status
      });
    }

    // Handle POST request to add a new horse
    if (req.method === "POST") {
      const { name, age } = await req.json(); // Parse the request body for name and age
      const permalink = "horsetider.dev/" + toKebabCase(name); // Create a permalink for the horse
      db.prepare("INSERT INTO horses (name, age, permalink) VALUES (?, ?, ?)").run(name, age, permalink); // Insert new horse into the database
      const horse = db.prepare("SELECT * FROM horses WHERE rowid = last_insert_rowid()").get() as Horse; // Fetch the newly inserted horse
      return new Response(JSON.stringify(horse), { // Return the new horse details as JSON
        headers: { "Content-Type": "application/json" }, // Set content type to JSON
        status: 201, // Return 201 status for created resource
      });
    }

    return new Response("Method Not Allowed", { status: 405 }); // Return 405 if method is not allowed
  } catch (error) {
    console.error("Error processing request:", (error as Error).message); // Log any errors during request processing
    return new Response("Internal Server Error", { status: 500 }); // Return 500 for internal server error
  }
});
