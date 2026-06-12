import express from 'express';
import mongoose from 'mongoose';
import DirectMessage from '../models/DirectMessage.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;

const hasValidParticipantIds = (ids) => ids.every((id) => mongoose.Types.ObjectId.isValid(id));

/**
 * GET /message/:userId/:partnerId
 * Fetch the chat history between two users.
 * The authenticated user must be one of the two participants.
 */
router.get('/message/:userId/:partnerId', authenticate, async (req, res) => {
    const { userId, partnerId } = req.params;

    // Prevent users from reading other people's conversations
    if (req.user._id.toString() !== userId) {
        return res.status(403).json({ error: 'You can only view your own conversations' });
    }

    if (!hasValidParticipantIds([userId, partnerId])) {
        return res.status(400).json({ error: 'Invalid participant id' });
    }

    try {
        // Fetch existing thread only — do not create one on a GET
        const chat = await DirectMessage.findOne({
            participants: { $all: [userId, partnerId] },
        }).populate('messages.sender', 'firstname lastname email role');

        // Return an empty message list if no thread exists yet
        if (!chat) {
            return res.json({ participants: [userId, partnerId], messages: [] });
        }

        res.json(chat);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch direct messages' });
    }
});

/**
 * POST /directmessages/:userId/:partnerId
 * Send a new message. The authenticated user must be the sender.
 */
router.post('/directmessages/:userId/:partnerId', authenticate, async (req, res) => {
    const { userId, partnerId } = req.params;

    // Prevent spoofed sends — the token user must match the userId param
    if (req.user._id.toString() !== userId) {
        return res.status(403).json({ error: 'You can only send messages as yourself' });
    }

    if (!hasValidParticipantIds([userId, partnerId])) {
        return res.status(400).json({ error: 'Invalid participant id' });
    }

    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
            error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
        });
    }

    try {
        let chat = await DirectMessage.findOne({
            participants: { $all: [userId, partnerId] },
        });

        if (!chat) {
            chat = await DirectMessage.create({
                participants: [userId, partnerId],
                messages: [],
            });
        }

        chat.messages.push({
            sender: userId,
            content: content.trim(),
            timestamp: new Date(),
        });

        await chat.save();

        const populated = await DirectMessage.findById(chat._id).populate(
            'messages.sender',
            'firstname lastname email role'
        );

        res.status(201).json(populated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * GET /mymessages/:user_id
 * List all conversations for the authenticated user.
 */
router.get('/mymessages/:user_id', authenticate, async (req, res) => {
    const { user_id } = req.params;

    if (req.user._id.toString() !== user_id) {
        return res.status(403).json({ error: 'You can only view your own messages' });
    }

    if (!mongoose.Types.ObjectId.isValid(user_id)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
        const chats = await DirectMessage.find({
            participants: { $in: [user_id] },
        }).populate('participants', 'firstname lastname role');

        res.json(chats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

export default router;