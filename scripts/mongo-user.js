// Run inside the MongoDB container. MONGODB_DB_NAME and USER_EMAIL are supplied by the caller.
const admin = db.getSiblingDB("admin")
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error("Could not authenticate to MongoDB.")
}

const name = process.env.MONGODB_DB_NAME
const email = process.env.USER_EMAIL
if (!name) throw new Error("MONGODB_DB_NAME is not set.")
if (!email || email.length > 254 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
  throw new Error("USER_EMAIL must be one email address.")
}

const database = db.getSiblingDB(name)
const hidden = /password|token|secret|hash|otp|code/i

function publicView(document) {
  const view = {}
  for (const key of Object.keys(document)) {
    if (!hidden.test(key)) view[key] = document[key]
  }
  return view
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const user = database.getCollection("user").findOne({
  email: { $regex: "^" + escapeRegex(email) + "$", $options: "i" },
})
if (!user) {
  print("No user with that email.")
  quit(1)
}

const userId = user._id
const userIdText = userId.toString()
const accounts = database.getCollection("account").find(
  { $or: [{ userId: userIdText }, { userId }] },
  { providerId: 1, accountId: 1, userId: 1, scope: 1, createdAt: 1, updatedAt: 1 },
).toArray().map(publicView)
const moderatorGrant = database.getCollection("moderatorGrants").findOne({ userId: userIdText })
const currentPolicyVersions = { terms: "1.0", privacy: "1.0" }
const userIds = [userIdText]
if (typeof user.id === "string" && user.id && user.id !== userIdText) userIds.push(user.id)
const acceptances = database.getCollection("userPolicyAcceptances").find({
  userId: { $in: userIds },
  documentType: { $in: ["terms", "privacy"] },
}).toArray()

function policyStatus(documentType) {
  const currentVersion = currentPolicyVersions[documentType]
  const acceptance = acceptances.find((row) => row.documentType === documentType && row.documentVersion === currentVersion)
  const status = { accepted: Boolean(acceptance), currentVersion }
  if (!acceptance) return status
  return { ...status, acceptedAt: acceptance.acceptedAt, method: acceptance.method, documentVersion: acceptance.documentVersion }
}

print(EJSON.stringify({
  user: publicView(user),
  accounts,
  moderatorGrant: moderatorGrant ? publicView(moderatorGrant) : null,
  policies: {
    terms: policyStatus("terms"),
    privacy: policyStatus("privacy"),
  },
}, null, 2))
