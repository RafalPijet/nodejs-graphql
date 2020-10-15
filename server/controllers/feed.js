const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator/check');
const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

const clearImage = filePath => {
    filePath = path.join(__dirname, '../', filePath);
    fs.unlink(filePath, err => {

        if (err) console.log(err)
    });
}

exports.getUserStatus = async (req, res, next) => {

    try {
        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({ status: user.status });
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.updateUserStatus = async (req, res, next) => {
    const { status } = req.body;
    const errors = validationResult(req);

    try {

        if (errors.array().length) {
            const error = new Error(`Validation error: ${errors.array()[0].msg}`);
            error.statusCode = 401;
            throw error
        }
        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        user.status = status;
        await user.save();
        res.status(200).json({ status: user.status })
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.getPosts = async (req, res, next) => {
    const { page } = req.query || 1;
    const perPage = 2;

    try {
        const totalItems = await Post.find().countDocuments();
        const posts = await Post.find()
        .populate('creator')
        .sort({createdAt: -1})
        .skip((page - 1) * perPage)
        .limit(perPage);
        res.status(200).json({
            message: 'Fetched posts successfully.',
            posts,
            totalItems
        })
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.postPost = async (req, res, next) => {
    const { title, content } = req.body;
    const image = req.file;
    const errors = validationResult(req);

    try {

        if (!errors.isEmpty()) {
            const error = new Error(`Validation failed: ${errors.array()[0].msg}`);
            error.statusCode = 422;
            throw error;
        }

        if (!image) {
            const error = new Error('No image provided.');
            error.statusCode = 422;
            throw error;
        }
        const post = new Post({
            title,
            content,
            creator: req.userId,
            imageUrl: image.path
        });
        await post.save();
        const user = await User.findById(req.userId);
        user.posts = [...user.posts, post];
        await user.save();
        io.getIO().emit('posts', {
            action: 'create',
            post: { ...post._doc, creator: { _id: req.userId, name: user.name } }
        })
        res.status(201).json({
            message: 'Post created successfully',
            post: post,
            creator: { _id: user._id, name: user.name }
        })
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.getPostById = async (req, res, next) => {
    const { postId } = req.params;

    try {
        const post = await Post.findById(postId);

        if (!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            message: 'Post has been found',
            post
        })
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.updatePost = async (req, res, next) => {
    const { postId } = req.params;
    const { title, content } = req.body;
    imageUrl = req.body.image;
    const image = req.file;
    const errors = validationResult(req);

    try {

        if (!errors.isEmpty()) {
            const error = new Error(`Validation failed: ${errors.array()[0].msg}`);
            error.statusCode = 422;
            throw error;
        }

        if (image) {
            imageUrl = image.path
        }

        if (!imageUrl) {
            const error = new Error('No file picked.');
            error.statusCode = 422;
            throw error;
        }
        const post = await Post.findById(postId).populate('creator');

        if (!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }

        if (post.creator._id.toString() !== req.userId) {
            const error = new Error('Not authorized!');
            error.statusCode = 403;
            throw error;
        }

        if (post.imageUrl !== imageUrl) {
            clearImage(post.imageUrl);
        }

        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        await post.save();
        io.getIO().emit('posts', { action: 'update', post });
        res.status(201).json({ message: 'Post has been updated', post });
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.deletePost = async (req, res, next) => {
    const { postId } = req.params;

    try {
        const post = await Post.findById(postId);

        if (!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }

        if (post.creator.toString() !== req.userId) {
            const error = new Error('Not authorized!');
            error.statusCode = 403;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(postId);
        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();
        io.getIO().emit('posts', {action: 'delete', post: postId})
        res.status(201).json({ message: 'Post has been removed' })
    } catch (err) {

        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}