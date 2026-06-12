import mongoose from 'mongoose';

const directMessageSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
    ],
    messages: [
        {
            sender: {
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'User',
                required: true
            },
            content: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            read: {
                type: Boolean,
                default: false
            },
        },
    ],
},
    {
        timestamps: true
    }
);

directMessageSchema.pre('save', function (next) {
    if (this.participants.length !== 2) {
        return next(new Error('DirectMessage must have exactly 2 participants.'));
    }
    next();
});

const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);
export default DirectMessage;
