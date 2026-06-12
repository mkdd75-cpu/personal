import express from 'express';
import Preceptor from '../models/Preceptor.js';

const router = new express.Router();

router.get('/preceptor', async (req, res) => {
    res.status(200).send("HELLO SERVER!")
})

router.post("/preceptor", async (req, res) => {
    try {
        const {
            firstname,
            middlename,
            lastname,
            email, 
            phone,
            dob,
            gender,
            address,
            cohort,
            role
        } = req.body;

        const newPreceptor = new Preceptor({
            firstname,
            middlename,
            lastname,
            email,
            phone,
            dob,
            gender,
            address,
            cohort,
            role
        });
        await newPreceptor.save();

        res.status(201).json({ message: "New preceptor created successfully", preceptor: newPreceptor });

    } catch (err) {
        if (err.name === "ValidationError") {

            return res.status(400).json({
                error: "Validation failed",
                details: err.errors,
            });
        }

        res.status(500).json({
            error: "Internal server error",
            message: err.message,
        });
    }
})
export default router