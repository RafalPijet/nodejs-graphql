const { validationResult } = require('express-validator/check');
const bcryptjs = require('bcryptjs');
const jsonwebtoken = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user');

exports.signup = async (req, res, next) => {
    const { email, name, password } = req.body;
    const errors = validationResult(req);
    
    try {

        if (!errors.isEmpty()) {
            const error = new Error('Validation failed');
            error.statusCode = 422;
            error.data = errors.array();
            throw error
        }
        const hashedPassword = await bcryptjs.hash(password, 12);
        const user = new User({
            email, name, password: hashedPassword
        })
        await user.save();
        res.status(201).json({ message: `User ${name} has been added.`, userId: user._id.toString() });
    } catch (err) {
        
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.login = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email: email });

        if (!user) {
            const error = new Error('A user with this email could not be found.');
            error.statusCode = 401;
            throw error;
        }

        if (!bcryptjs.compare(password, user.password)) {
            const error = new Error('Wrong password!');
            error.statusCode = 401;
            throw error;
        }
        const token = jsonwebtoken.sign({
            email: user.email,
            userId: user._id.toString()
        }, process.env.PRIVATE_KEY, { expiresIn: '1h' })
        res.status(200).json({ token, userId: user._id.toString() });
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}