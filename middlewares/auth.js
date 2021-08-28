const jwt = require('jsonwebtoken');
const { users } = require('../db');

module.exports = async (req, res, next) => {
    let secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET env variable is required');
    }
    let token = req.header('x-auth-token');
    if (!token) return res.status(401).send('Unauthorized');
    try {
        const payload = await jwt.verify(token, secret);
        const user = await users.findOne({ email: payload.email })
        if (!user) {
            return  res.status(401).send('Unauthorized');
        }
        req.user = user;
        return next();
    } catch (e) {
        return res.status(401).send('Unauthorized');
    }
}