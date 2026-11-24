// Run inside the MongoDB container. MONGODB_DB_NAME and COLLECTION_NAME are supplied by the caller.
const admin = db.getSiblingDB("admin")
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error("Could not authenticate to MongoDB.")
}

const name = process.env.MONGODB_DB_NAME
const collectionName = process.env.COLLECTION_NAME
if (!name) throw new Error("MONGODB_DB_NAME is not set.")
if (!collectionName || !/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(collectionName)) {
  throw new Error("COLLECTION_NAME must be one collection name.")
}

const database = db.getSiblingDB(name)
const names = database.getCollectionNames()
if (!names.includes(collectionName)) {
  print("No collection named " + collectionName + ".")
  quit(1)
}

const hidden = /password|token|secret|hash|otp|code/i
const limit = 25

function isLeaf(value) {
  return value === null || typeof value !== "object" || value instanceof Date || typeof value._bsontype === "string"
}

function publicView(value) {
  if (isLeaf(value)) return value
  if (Array.isArray(value)) return value.map(publicView)
  const view = {}
  for (const key of Object.keys(value)) {
    if (!hidden.test(key)) view[key] = publicView(value[key])
  }
  return view
}

const collection = database.getCollection(collectionName)
const total = collection.countDocuments()
print(collectionName + " (" + total + ")")
if (!total) {
  print("(empty)")
  quit(0)
}
collection.find().sort({ _id: -1 }).limit(limit).forEach((document) => {
  print(EJSON.stringify(publicView(document), null, 2))
})
if (total > limit) print("Showing " + limit + " of " + total + ".")
