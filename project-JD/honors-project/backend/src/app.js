import express from 'express';
import cors from 'cors';
import './db/mongoose.js';
import userRouter from './users/routers/user.js';
import directMessageRouter from './messages/routers/direct-message.js';
import appointmentRouter from './appointments/routers/appointment.js';
import recordsRouter from './records/routers/records.js';

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
}));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use(userRouter);
app.use(directMessageRouter);
app.use(appointmentRouter);
app.use(recordsRouter);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => console.log(`Server running on port ${port}`));