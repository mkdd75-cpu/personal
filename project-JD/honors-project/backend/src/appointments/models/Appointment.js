import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    // The user who requested/created the appointment
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // The user the appointment is with
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Denormalised role of the patient in this appointment, for easy filtering
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    visitType: {
        type: String,
        enum: ['screening', 'acute', 'follow-up', 'counseling'],
        default: 'screening'
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled', 'declined'],
        default: 'pending'
    },
    notes: {
        type: String,
        trim: true
    },
},
    { timestamps: true }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;