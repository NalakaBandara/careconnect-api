import express from 'express';

const app = express();

//middleware
app.use(express.json());

//Health endpoint
app.get('/health', (req, res) => {

    res.status(200).json({
        application: 'Career Connect API [Node.js]',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

export default app;