import app from './app.js';
import { logger } from './config/logger.js';


const PORT = process.env.PORT || 3000;

logger.info({ port: PORT }, "Careconnect API started");

app.listen(PORT, () => {
    console.log(`Careconnect API is running on port - ${PORT}`);
    logger.info({ port: PORT }, "Careconnect API is running");
});