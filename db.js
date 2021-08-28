const monk = require('monk');

const db = monk(process.env.MONGO_URI);
const users = db.get("users");
const books = db.get("books");
const orders = db.get("orders");

module.exports = {
    users,
    books,
    orders,
    db
};