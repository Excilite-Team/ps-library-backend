require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const yup = require('yup');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const auth = require('./middlewares/auth');
const isAdmin = require('./middlewares/isAdmin')
const email = require('./mailer');
const { users, books, orders } = require('./db');

const app = express();

app.use(helmet());
app.use(morgan('tiny'));
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const book_genres = [
    "sarguzasht",
    "fantastika",
    "romantika",
    "komediya",
    "klassika",
    "biznes",
    "detektiv",
    "roman",
    "biografiya",
    "avtobiografiya",
    "falsafa",
    "shaxsiy-rivojlanish"
]

const monstrous_URL_regex = /^((https?|ftp):\/\/)?(www.)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i

const user_scheme = yup.object().shape({
    name: yup.string().required(),
    email: yup.string().email().required(),
    password: yup.string().required(),
})

const book_scheme = yup.object().shape({
    name: yup.string().required(),
    nameUZ: yup.string().required(),
    nameRU: yup.string().required(),
    author: yup.string().required(),
    authorUZ: yup.string().required(),
    authorRU: yup.string().required(),
    image: yup.string().required(),
    pdf: yup.string().matches(URL, 'The entered URL is not valid'),
    genre: yup.mixed().required().oneOf(book_genres),
    isAvailable: yup.bool().default(true),
})

const order_scheme = yup.object().shape({
    userId: yup.string().required(),
    bookId: yup.string().required(),
    isCancelled: yup.bool().default(false),
    isAccepted: yup.bool().default(false),
    until: yup.date().default(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))
})

app.post('/api/orders/new', auth, async (req, res, next) => {
    let user = req.user;
    let { bookId, until = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) } = req.body;
    try {
        let book = await books.findOne({ bookID: bookId });
        if (!book) {
            return res.status(404).send('Not found');
        }
        let order = {
            userId: user.userID,
            bookId: book.bookID,
            isCancelled: false,
            isAccepted: false,
            until
        };
        await order_scheme.validate(order);
        let created = await orders.insert(order);
        return res.status(201).json(created);
    } catch (e) {
        next(e);
    }
})

app.get('/api/orders/my', auth, async (req, res) => {
    let user = req.user;
    let result = await orders.find({ userId: user.userID });
    res.json(result);
})

app.get('/api/orders', auth, isAdmin, async (req, res) => {
    let { limit = 20, skip = 0 } = req.query;
    let result = await orders.find({}, {
        skip: parseInt(skip),
        limit: parseInt(limit)
    });
    res.json(result);
})

app.put('/api/orders/:id/cancel', auth, async (req,res) => {
    
    let result = await orders.findOneAndUpdate({ _id: req.params.id, isAccepted: false }, {
        $set: {
            isCancelled: true
        }
    });
    const user = await users.findOne({ userID: result.userId });
    
    email({
        to: user.email,
        subject: "So'rovingiz qabul qilinmadi!",
        content: `Hurmatli ${user.name}, afsuski sizning so'rovingiz qabul qilinmadi!`,
        html: `<i>Bu email akkaunt komputer tomonidan boshqariladi. Iltimos, bu emailga javob qaytarmang.</i>`
    })
    res.json(result);
})

app.put('/api/orders/:id/accept', auth, isAdmin, async (req,res) => {
    let result = await orders.findOneAndUpdate({ _id: req.params.id, isCancelled: false }, {
        $set: {
            isAccepted: true
        }
    });
    
    if (!result) {
        return res.status(404).send('Order might be cancelled');
    }
    
    await books.findOneAndUpdate({ bookID: result.bookId }, {
        $set: {
            isAvailable: false
        }
    })
    
    const user = await users.findOne({ userID: result.userId });
    
    email({
        to: user.email,
        subject: "So'rovingiz qabul qilindi!",
        content: `Hurmatli ${user.name}, sizning so'rovingiz administrator(lar) tomonidan ko'rib chiqildi va qabul qilindi!`,
        html: `<i>Bu email akkaunt komputer tomonidan boshqariladi. Iltimos, bu emailga javob qaytarmang.</i>`
    })
    
    return res.json(result);
});

app.get('/api/auth', auth, async (req,res) => {
    res.status(200).send(req.user);
})

app.delete('/api/orders/:id/complete', auth, isAdmin, async (req,res) => {
    let result = await orders.remove({ _id: req.params.id });
    return res.status(200).json(result?.result);
})

app.get("/api/users", auth, isAdmin, async (req, res) => {
    let allUsers = await users.find();
    res.json(allUsers);
})

app.get("/api/books", async (req, res) => {
    let genre = req.query.genre;
    let author = req.query.author;
    let authorRU = req.query.authorRU;
    let authorUZ = req.query.authorUZ;
    let name = req.query.name;
    let nameUZ = req.query.nameUZ;
    let nameRU = req.query.nameRU;

    let searchQuery = {};
    if (genre) searchQuery["genre"] = genre;
    if (author) searchQuery["author"] = { "$regex": author, "$options": "i" };
    if (authorUZ) searchQuery["authorUZ"] = { "$regex": authorUZ, "$options": "i" };
    if (authorRU) searchQuery["authorRU"] = { "$regex": authorRU, "$options": "i" };
    if (name) searchQuery["name"] = { "$regex": name, "$options": "i" };
    if (nameRU) searchQuery["nameRU"] = { "$regex": nameRU, "$options": "i" };
    if (nameUZ) searchQuery["nameUZ"] = { "$regex": nameUZ, "$options": "i" };
    let resdict = await books.find(searchQuery);
    res.json(resdict);
})

app.get('/api/genres', async (req, res) => {
    return res.json(book_genres);
})

app.get("/api/users/:id", auth, isAdmin, async (req, res) => {
    let userid = req.params.id;
    let user = await users.findOne({ userID: userid });
    res.json(user);
})

app.get("/api/books/:id", async (req, res) => {
    let bookid = req.params.id;
    let book = await books.findOne({ bookID: bookid });
    if (!book) res.status(500)
    else res.json(book);
})

app.put('/api/users/:id', auth, isAdmin, async (req, res) => {
    let userid = req.params.id;
    let user = await users.findOneAndUpdate({ userID: userid }, {
        $set: {
            isAdmin: true
        }
    });
    if (!user) {
        return res.status(404).send('Not found');
    }
    return res.status(200).json(user);
});

app.post("/api/books/new/", auth, isAdmin, async (req, res, next) => {
    let { author, authorUZ, authorRU, genre, name, nameUZ, nameRU, image, pdf, isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') isAvailable = true;
    try {
        await book_scheme.validate({
            name,
            nameUZ,
            nameRU,
            author,
            authorUZ,
            authorRU,
            image,
            pdf,
            genre,
            isAvailable
        })

        let now = new Date();
        let bookid = nanoid(5);
        let exists = await books.findOne({ bookID: bookid });
        if (exists) bookid = nanoid(5)

        const created = await books.insert({
            bookID: bookid.toLowerCase(),
            name: name,
            nameUZ: nameUZ,
            nameRU: nameRU,
            author: author,
            authorUZ: authorUZ,
            authorRU: authorRU,
            image: image,
            pdf: pdf,
            genre: genre,
            isAvailable: isAvailable,
            dateCreated: now
        })

        res.json(created)

    } catch (e) {
        next(e)
    }
})

app.post('/api/users/register', async (req, res, next) => {
    let { name, email, password } = req.body;
    try {
        let user = await users.findOne({ email });
        if (user) {
            return res.status(400).send('Email is already in use');
        }
        let hashedPassword = await bcrypt.hash(password, 10);
        await user_scheme.validate({
            name,
            email,
            password: hashedPassword
        })
        let userid = nanoid(7);
        let exists = await users.findOne({ userID: userid });
        if (exists) userid = nanoid(7);

        const created = await users.insert({
            userID: userid.toLowerCase(),
            name,
            email,
            password: hashedPassword,
            isAdmin: false
        })

        return res.status(201).json(created);
    } catch (e) {
        next(e);
    }
})

app.post('/api/users/login', async (req, res, next) => {
    let { email, password } = req.body;
    try {
        let user = await users.findOne({ email });
        if (!user) {
            return res.status(404).send('Unable to find that user');
        }
        let isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).send('Email or password is incorrect');
        };
        let secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET env variable is required');
        }
        let token = jwt.sign({
            email: user.email,
            userID: user.userID
        }, secret, { expiresIn: '7d' });
        res.status(200).send(token);

    } catch (e) {
        next(e);
    }
});

app.use((error, req, res, next) => {
    if (error.status) res.status(error.status)
    else res.status(500)

    res.json({
        message: req.message,
        stack: process.env.NODE_ENV === 'production'
            ? "Production Environment prevents you from viewing the error stack, change it to view"
            : error.stack
    })
})

const port = process.env.PORT || 3000

app.listen(port, () => console.log(`Server is listening at port ${port}`));
