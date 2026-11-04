import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

test("npm stop commands stop MongoDB, and stop:docker also quits Docker", { skip: process.platform !== "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "unarchive-stop-test-"))
  try {
    await mkdir(join(root, "scripts"))
    await copyFile("scripts/stop.ps1", join(root, "scripts", "stop.ps1"))
    await writeFile(join(root, "scripts", "stack-common.ps1"), "function Get-ProjectDevServer { return $null }\n")
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "stop-test", version: "1.0.0", scripts: pkg.scripts }))
    await writeFile(join(root, "docker.cmd"), '@echo off\r\necho %*>>"%STOP_TEST_LOG%"\r\nexit /b 0\r\n')
    const log = join(root, "docker.log")
    const run = name => spawnSync("npm.cmd", ["run", name], {
      cwd: root, encoding: "utf8", shell: true,
      env: { ...process.env, PATH: `${root};${process.env.PATH}`, STOP_TEST_LOG: log },
    })
    let result = run("stop")
    assert.equal(result.status, 0, result.stderr)
    let calls = await readFile(log, "utf8")
    assert.match(calls, /compose --env-file \.env\.local stop mongodb/)
    assert.doesNotMatch(calls, /desktop stop/)
    await writeFile(log, "")
    result = run("stop:docker")
    assert.equal(result.status, 0, result.stderr)
    calls = await readFile(log, "utf8")
    assert.match(calls, /compose --env-file \.env\.local stop mongodb/)
    assert.match(calls, /desktop stop --timeout 180/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
