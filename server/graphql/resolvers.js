const fs = require('fs');
const path = require('path');
const bcryptjs = require('bcryptjs');
const validator = require('validator');
const jsonwebtoken = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user');
const Post = require('../models/post');

const clearImage = filePath => {
    filePath = path.join(__dirname, '../', filePath);
    fs.unlink(filePath, err => {

        if (err) console.log(err);
    });
};

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
    },
    getPost: async ({id}, req) => {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');

        if (!post) {
            const error = new Error('Could not find post');
            error.status = 404;
            throw error;
        }

        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        };
    },
    updatePost: async ({id, postInput}, req) => {
        const errors = [];

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }

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
        
        const post = await Post.findById(id).populate('creator');

        if (!post) {
            const error = new Error('Could not find post');
            error.status = 400;
            throw error;
        }

        if (post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.status = 403;
            throw error;
        }

        post.title = postInput.title;
        post.content = postInput.content;

        if (postInput.imageUrl !== 'undefined') {
            clearImage(post.imageUrl);
            post.imageUrl = postInput.imageUrl;
        }
        await post.save();
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        };
    },
    deletePost: async ({id}, req) => {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }

        const post = await Post.findById(id);

        if (!post) {
            const error = new Error('Could not find post');
            error.status = 404;
            throw error;
        }

        if (post.creator.toString() !== req.userId) {
            const error = new Error('Not authorized!');
            error.status = 403;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.posts.pull(id);
        await user.save();
        return {
            message: 'Post has been removed'
        };
    },
    userStatus: async (args, req) => {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }

        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('User not found.');
            error.status = 404;
            throw error;
        }

        return {
            status: user.status
        };
    },
    updateUserStatus: async ({status}, req) => {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.status = 401;
            throw error;
        }

        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('User not found.');
            error.status = 404;
            throw error;
        }

        user.status = status;
        const updatedUser = await user.save();
        return {
            status: updatedUser.status
        };
    }
};