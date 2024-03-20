const REDIS_PORT: number = Number(process.env.REDIS_PORT);
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const AuthToken = process.env.AuthToken;

export { REDIS_PORT, REDIS_URL, REDIS_PASSWORD, AuthToken };
