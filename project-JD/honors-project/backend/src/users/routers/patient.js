import express from "express";
import Patient from '../models/Patient.js';
import User from "../models/User.js";

const router = new express.Router();

router.get('/patient', async (req, res) => {
    res.status(200).send("HELLO SERVER!")
})
router.post("/signin", async (req, res) => {
    try {
        const {
            email,
            password 
        } = req.body;

        let user = await User.findOne({
            email: email,
            password: password
        })

        res.status(200).json(user);
    }
    catch {
        res.status(404)
    }
})

router.post("/patient", async (req, res) => {
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
            emergencyContact,
            role
        } = req.body;

        const newPatient = new Patient({
            firstname,
            middlename,
            lastname,
            email,
            phone,
            dob,
            gender,
            address,
            emergencyContact,
            role
        });
        await newPatient.save();

        res.status(201).json({ message: "New patient created successfully", patient: newPatient });

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