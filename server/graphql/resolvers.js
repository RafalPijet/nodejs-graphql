const bcryptjs = require('bcryptjs');
const validator = require('validator');
const jsonwebtoken = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user');
const Post = require('../models/post');

module.exports = {
    createUser: async ({ userInput }, req) => {
        const errors = [];

        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'E-mail is invalid' });
        }

        if (validator.isEmpty(userInput.password) || !validator.isLength(userInput.password, { min: 5 })) {
            errors.push({ message: "Password too short!" });
        }

        if (errors.length) {
            const error = new Error('Invalid input!');
            error.data = errors;
            error.status = 422;
            throw error;
        }
        const existingUser = await User.findOne({ email: userInput.email });

        if (existingUser) {
            throw new Error('User exists already!');
        }
        const hashedPassword = await bcryptjs.hash(userInput.password, 12);
        const user = new User({
            name: userInput.name,
            email: userInput.email,
            password: hashedPassword
        });
        const createdUser = await user.save();
        return { ...createdUser._doc, _id: createdUser._id.toString() };
    },
    login: async ({ email, password }) => {
        const existingUser = await User.findOne({ email: email });

        if (!existingUser) {
            const error = new Error('User exists already!');
            error.status = 401;
            throw error;
        }

        if (!bcryptjs.compare(password, existingUser.password)) {
            const error = new Error('Wrong password!');
            error.statusCode = 401;
            throw error;
        }
        const token = jsonwebtoken.sign({
            email: existingUser.email,
            userId: existingUser._id.toString()
        }, process.env.PRIVATE_KEY, { expiresIn: '1h' });
        return { userId: existingUser._id.toString(), token };
    },
    createPost: async ({ postInput }, req) => {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }
        const errors = [];

        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
            errors.push({ message: 'Title is valid' });
        }

        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, { min: 5 })) {
            errors.push({ message: 'Content is valid' });
        }

        if (validator.isEmpty(postInput.imageUrl)) {
            errors.push({ message: "ImageUrl can't be empty" });
        }

        if (errors.length) {
            const error = new Error('Invalid input!');
            error.data = errors;
            error.status = 422;
            throw error;
        }
        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('Invalid user!');
            error.status = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        user.posts = [...user.posts, post];
        await user.save();
        const createdPost = await post.save();
        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };
    },
    loadPosts: async ({page}, req) => {
        const perPage = 2;

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }

        if (!page) {
            page = 1;
        }

        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find()
            .populate('creator')
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage);

        return {
            totalPosts,
            posts: posts.map(item => {
                return {
                    ...item._doc,
                    _id: item._id.toString(),
                    createdAt: item.createdAt.toISOString(),
                    updatedAt: item.updatedAt.toISOString()
                };
            })
        };
    }
};