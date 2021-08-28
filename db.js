const monk = require('monk');

const db = monk(process.env.MONGO_URI);
const users = db.get("users");
const books = db.get("books");

module.exports = {
    users,
    books,
    db
};