import mongoose from 'mongoose';
import validator from 'validator';

const userSchema = new mongoose.Schema({
    // Personal Info
    firstname: {
        type: String,
        minlength: 1,
        required: true,
        trim: true
    },
    middlename: {
        type: String,
        trim: true, 
        required: false
    },
    lastname: {
        type: String, 
        minlength: 2,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        validate: {
            validator: (v) => validator.isEmail(v),
            message: (props) => `${props.value} is not a valid email address`,
        },
    },
    phone: {
        type: String,
        required: true,
        validate: {
            validator: (v) => validator.isMobilePhone(v, 'any'),
            message: (props) => `${props.value} is not a valid phone number`,
        },
    },
    dob: {
        type: Date,
        required: true,
        validate: {
            validator: (v) => v < new Date(),
            message: 'Date of birth must be in the past',
        },
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
        required: true
    },
    address: {
        street: { type: String, minlength: 3, required: true, trim: true },
        city: { type: String, minlength: 2, required: true, trim: true },
        stateOrRegion: { type: String, minlength: 2, required: true, trim: true },
    },

    // Authentication
    password: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },

    // Role-based fields
    role: {
        type: String,
        enum: ['doctor', 'preceptor', 'patient', 'admin'],
        required: true
    },

    // for doctors/preceptors
    specialization: {
        type: String
    },
    cohort: {
        type: String,
    },

    // Patient-specific fields
    emergencyContact: {
        name: {
            type: String,
            minlength: 2,
            trim: true
        },
        phone: {
            type: String,
            validate: {
                validator: (v) => !v || validator.isMobilePhone(v, 'any'),
                message: (props) => `${props.value} is not a valid phone number`,
            },
        },
        email: {
            type: String,
            lowercase: true,
            validate: {
                validator: (v) => !v || validator.isEmail(v),
                message: (props) => `${props.value} is not a valid email address`,
            },
        },
    },
    nhisStatus: {
        isActive: {
            type: Boolean
        },
        nhisExpiry: {
            type: Date
        },
        nhisId: {
            type: String
        },
    },
    medicalRecords: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MedicalRecord'
        }
    ],
    appointments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Encounter'
        }
    ],
    riskCategory: {
        type: String,
        enum: ['low', 'moderate', 'high']
    },

    // Doctor/Preceptor-specific fields
    patients: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    ratings: [
        {
            type: Number
        }
    ],
    reviews: [
        {
            reviewer: String,
            rating: Number,
            comment: String,
            date: Date
        }
    ],

    // Messaging & Notifications
    chats: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat'
        }
    ],
    lastMessageRead: {
        type: Map,
        of: Date
    },
    notifications: [
        {
            type: String
        }
    ],
    preferences: {
        smsOptIn: {
            type: Boolean,
            default: true
        },
        emailOptIn: {
            type: Boolean,
            default: true
        },
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        },
    },

    // Profile & UI
    profilePicture: { type: String },

},
    {
        timestamps: true
    }
);

// Role-based validation
userSchema.pre('validate', function (next) {
    if (this.role === 'patient' && !this.emergencyContact?.name) {
        this.invalidate('emergencyContact.name', 'Patients must have an emergency contact.');
    }
    if ((this.role === 'doctor' || this.role === 'preceptor') && !this.cohort) {
        this.invalidate('cohort', `${this.role} must have a cohort.`);
    }
    next();
});

const User = mongoose.model('User', userSchema);
export default User;