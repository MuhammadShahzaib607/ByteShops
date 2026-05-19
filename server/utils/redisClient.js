import { createClient } from 'redis';
import dotenv from "dotenv"

dotenv.config()

const redisClient = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

redisClient.on('error', (err) => console.log('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis Cloud Successfully!'));

await redisClient.connect();

export default redisClient;