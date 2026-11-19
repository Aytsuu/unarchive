// Run inside the MongoDB container. MONGODB_DB_NAME is supplied by the caller.
const admin = db.getSiblingDB("admin")
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error("Could not authenticate to MongoDB.")
}
const name = process.env.MONGODB_DB_NAME
if (!name) throw new Error("MONGODB_DB_NAME is not set.")
const database = db.getSiblingDB(name)
const names = database.getCollectionNames().sort()
if (!names.length) print("(no collections)")
names.forEach((collection) => {
  print(collection + "\t" + database.getCollection(collection).countDocuments())
})
