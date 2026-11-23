export function readTestAccount(text) {
  const username = text.match(/^\s*username\s*=\s*(\S.*?)\s*$/m)?.[1]?.trim() ?? ""
  const password = text.match(/^\s*password\s*=\s*(\S.*?)\s*$/m)?.[1]?.trim() ?? ""
  if (!username || !password) throw new Error("Set username and password in .env.local.")
  return { username, password }
}
