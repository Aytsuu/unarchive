import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

test("restart runs stop then stack and stops on failure", { skip: process.platform !== "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "unarchive-restart-test-"))
  try {
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "restart-test", version: "1.0.0", scripts: { restart: pkg.scripts.restart, stop: "node stop.cjs", stack: "node stack.cjs" } }))
    await writeFile(join(root, "stop.cjs"), "require('fs').appendFileSync('calls.log', 'stop\\n'); if (process.env.TEST_STOP_FAILURE) process.exit(1)")
    await writeFile(join(root, "stack.cjs"), "require('fs').appendFileSync('calls.log', 'stack\\n')")
    const run = (fail) => spawnSync("npm.cmd", ["run", "restart"], { cwd: root, encoding: "utf8", shell: true, env: { ...process.env, TEST_STOP_FAILURE: fail ? "1" : "" } })
    let result = run(false)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(await readFile(join(root, "calls.log"), "utf8"), "stop\nstack\n")
    await writeFile(join(root, "calls.log"), "")
    result = run(true)
    assert.notEqual(result.status, 0)
    assert.equal(await readFile(join(root, "calls.log"), "utf8"), "stop\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
