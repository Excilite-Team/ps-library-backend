const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const yup = require('yup');
const monk = require('monk');
const { nanoid } = require('nanoid');

const app = express();

app.use(helmet());
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json());

require('dotenv').config();

const db = monk(process.env.MONGO_URI);
const users = db.get("users");
const books = db.get("books");

const book_genres = [
    "adventure",
    "sci-fi",
    "romance",
    "comedy",
    "classical",
    "detective",
]

const user_scheme = yup.object().shape({
    name: yup.string().required().matches(/[\w\-]/i),
    password: yup.string().required().matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/),
})

const book_scheme = yup.object().shape({
    name: yup.string().required(),
    author: yup.string().required(),
    image: yup.string().required(),
    genre: yup.mixed().required().oneOf(book_genres),  
    isAvailable: yup.bool().default(() => { return true }),
})

app.get("/api/users/", async (req, res) => {
    let allUsers = await users.find();
    res.json(users);
})

app.get("/api/books/", async (req, res) => {
    let allBooks = await books.find();
    res.json(allBooks);
})

app.get("/api/users/:id", async (req, res) => {
    let userid = req.params.id;
    let user = await users.findOne({userID: userid});
    res.json(user);
})

app.get("/api/books/:id", async (req, res) => {
    let bookid = req.params.id;
    let book = await books.findOne({bookID: bookid});
    if (!book) res.status(500)
    else res.json(book);
})

app.post("/api/books/new/", async (req, res, next) => {
    let { author, genre, name, image, isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') isAvailable = true;
    try {
        await book_scheme.validate({
            name,
            author,
            image,
            genre,
            isAvailable
        })

        let now = new Date();   
        let bookid = nanoid(5);
        let exists = await books.findOne({bookID: bookid});
        if (exists) bookid = nanoid(5) 

        const created = await books.insert({
            bookID: bookid.toLowerCase(),
            name: name,
            author: author,
            image: image,
            genre: genre,
            isAvailable: isAvailable,
            dateCreated: now
        })
        
        res.json(created)

    } catch (e) {
        next(e)
    }
})

app.use( (error, req, res, next) => {
    if (error.status) res.status(error.status)
    else res.status(500)

    res.json({
        message: req.message,
        stack: process.env.NODE_ENV === 'production' 
            ? "Production Environment prevents you from viewing the error stack, change it to view"
            : error.stack
     })
} )

const port = process.env.PORT || 3000

app.listen(port, () => console.log(`Server is listening at port ${port}`));