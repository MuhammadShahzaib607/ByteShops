import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import mongoose from "mongoose"
import "./utils/redisClient.js"
import authRoutes from "./routes/auth.js"
import storeRoutes from "./routes/store.js"
import storeViewRoutes from "./routes/storeView.js"
import productRoutes from "./routes/product.js"
import serviceRoutes from "./routes/service.js"
import orderRoutes from "./routes/order.js"
import { sendRes } from "./utils/responseHandler.js"

dotenv.config()
const app = express()

app.set("trust proxy", 1);
app.use(cors())
app.use(express.json())
app.use("/api/user", authRoutes)
app.use("/api/store", storeRoutes)
app.use("/api/views", storeViewRoutes)
app.use("/api/product", productRoutes)
app.use("/api/service", serviceRoutes)
app.use("/api/order", orderRoutes)

app.get("/", (req, res)=> {
    sendRes(res, 200, true, "API hit successfully")
})

app.get("/health-check", (req, res)=> {
    sendRes(res, 200, true, "ok")
})

const connectDB = async ()=> {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Database Connect Successfully")
    } catch (error) {
        console.log("error ==>> " + error.message)
    }
}

connectDB()

if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app;