import { connect, Schema } from 'mongoose';

Schema.Types.String.set('trim', true);

if (!process.env.MONGODB_URL) {
    console.error('MONGODB_URL is required.');
    process.exit(1);
}

connect(process.env.MONGODB_URL)
    .then(() => {
        console.log('Connection to database successful.');
    })
    .catch((error) => {
        console.error('Database connection failed.', error);
        process.exit(1);
    });
