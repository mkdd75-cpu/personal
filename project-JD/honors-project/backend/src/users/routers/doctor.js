import express from 'express';
import Doctor from '../models/Doctor.js';

const router = new express.Router();

router.get('/doctor', async (req, res) => {
    res.status(200).send("HELLO SERVER!")
})

router.post("/doctor", async (req, res) => {
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

        const newDoctor = new Doctor({
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
        await newDoctor.save();

        res.status(201).json({ message: "New doctor created successfully", doctor: newDoctor });

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