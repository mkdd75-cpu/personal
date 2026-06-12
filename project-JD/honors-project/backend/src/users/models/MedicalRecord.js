import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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

    medicalHistory: {
        chronicConditions: [
            {
                type: String
            }
        ],
        allergies: [
            {
                type: String
            }
        ],
        surgeries: [
            {
                type: String
            }
        ],
        familyHistory: [
            {
                type: String
            }
        ],
    },

    encounters: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Encounter'
        }
    ],
},
    {
        timestamps: true
    }
);

const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);
export default MedicalRecord;
