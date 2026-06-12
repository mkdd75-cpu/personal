import mongoose from 'mongoose';

const encounterSchema = new mongoose.Schema({
    role: {
        type: mongoose.Schema.Types.ObjectId,
        enum: ['Patient', 'Doctor', 'Preceptor'],
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        enum: ['Patient', 'Doctor', 'Preceptor'],
        ref: 'User',
        required: true
    },
    visitType: {
        type: String,
        enum: ['screening', 'acute', 'follow-up', 'counseling'],
        required: true
    },
    visitDate: {
        type: Date,
        required: true
    },

    reason: {
        type: String,
        required: true
    },
    diagnosis: {
        type: String
    },

    vitals: [
        {
            type: {
                type: String,
                enum: ['bloodPressure', 'bloodGlucose', 'weight', 'height', 'BMI'],
                required: true
            },
            value: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
        },
    ],

    labResults: [
        {
            testName: {
                type: String,
                required: true
            },
            value: {
                type: String,
                required: true
            },
            normalRange: {
                type: String
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
        },
    ],

    treatment: [
        {
            medication: String,
            dose: String,
            duration: String,
        },
    ],

    counselingNotes: {
        type: String
    },

    referrals: [
        {
            facility: String,
            reason: String,
            date: Date,
        },
    ],

    actionPlan: [
        {
            type: String
        }
    ],
    todoList: [
        {
            type: String
        }
    ],
    upcomingAppointments: [
        {
            type: Date
        }
    ],
    missedAppointments: {
        type: Number,
        default: 0
    },
    smsReminder: {
        type: Boolean,
        default: true
    },
},
    {
        timestamps: true
    }
);

const Encounter = mongoose.model('Encounter', encounterSchema);
export default Encounter;
