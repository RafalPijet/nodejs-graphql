const bcryptjs = require('bcryptjs');
const User = require('../models/user');

module.exports = {
    createUser: async ({ userInput }, req) => {
        const existingUser = await User.findOne({email: userInput.email});

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
        return {...createdUser._doc, _id: createdUser._id.toString()};
    }
};