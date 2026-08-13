/**
 * Debug script to test grep_search tool directly
 */

import { ClaudeCodeToolsFactory } from "@kudos/scene-graph-manager/tools";

async function testGrepTool() {
  console.log("🔍 Testing grep_search tool directly\n");
  console.log("=" .repeat(60));

  // Create Claude Code Tools
  const toolsFactory = new ClaudeCodeToolsFactory({
    rootDir: process.cwd(),
  });

  const tools = toolsFactory.createTools();
  const grepTool = tools.grepSearch;

  console.log("\n📋 Tool Name:", grepTool.name);
  console.log("📋 Tool Description:", grepTool.description);

  // Test 1: Search for WorkflowEngine in src directory
  console.log("\n" + "-".repeat(60));
  console.log("Test 1: Search for 'WorkflowEngine' in src directory");
  console.log("-".repeat(60));

  try {
    const result = await grepTool.invoke({
      pattern: "WorkflowEngine",
      search_path: "src",
      glob_pattern: "*.ts",
    });

    console.log("\n✅ Search Result:");
    console.log(result);
    console.log("\n📊 Result length:", result.length);
    console.log("📊 Contains matches:", !result.includes("マッチなし"));
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }

  // Test 2: Search for a non-existent pattern
  console.log("\n" + "-".repeat(60));
  console.log("Test 2: Search for 'NonExistentPattern123' in src directory");
  console.log("-".repeat(60));

  try {
    const result = await grepTool.invoke({
      pattern: "NonExistentPattern123",
      search_path: "src",
      glob_pattern: "*.ts",
    });

    console.log("\n✅ Search Result:");
    console.log(result);
    console.log("\n📊 Result length:", result.length);
    console.log("📊 Contains matches:", !result.includes("マッチなし"));
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }

  // Test 3: Search for 'class WorkflowEngine'
  console.log("\n" + "-".repeat(60));
  console.log("Test 3: Search for 'class WorkflowEngine' in src directory");
  console.log("-".repeat(60));

  try {
    const result = await grepTool.invoke({
      pattern: "class WorkflowEngine",
      search_path: "src",
      glob_pattern: "*.ts",
    });

    console.log("\n✅ Search Result:");
    console.log(result);
    console.log("\n📊 Result length:", result.length);
    console.log("📊 Contains matches:", !result.includes("マッチなし"));
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Tests completed!");
  console.log("=".repeat(60));
}

testGrepTool().catch(console.error);
