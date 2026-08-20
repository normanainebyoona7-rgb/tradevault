// test-env.js

const fs = require("fs");
const path = require("path");

// Read .env.local manually
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

console.log("=== .env.local content ===");
console.log(envContent);
console.log("=== End ===");

// Check if MONGODB_URI exists
if (envContent.includes("MONGODB_URI")) {
  console.log("✅ MONGODB_URI found");
} else {
  console.log("❌ MONGODB_URI NOT found");
}
