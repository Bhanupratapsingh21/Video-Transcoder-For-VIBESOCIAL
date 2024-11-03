import express, { json, urlencoded } from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import processervideocontroller from './Contollers/Videoprocessingcontroller.js';
import dotenv from 'dotenv'
import cron from 'node-cron';
import { processVideo } from './Contollers/Videoprocessingqueaecontoller.js';
import { Video } from './models/Video.model.js';

dotenv.config({
    path: "./env"
});

const corsarry = [
    process.env.CORS_ORIGIN1,
    process.env.CORS_ORIGIN2,
    process.env.CORS_ORIGIN3,
]

let currentJob = {
    videoId: null,
    status: "idle",
};

/// use is used for middle wares or configration parts
const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true, // Allow credentials
    preflightContinue: false,
    optionsSuccessStatus: 204
    // read about cors or cridentials or whitelisting 
}))

app.use(json());
app.use(urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "-" + uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
    res.status(200).json({ "MSG": "Hello from server" });
});

app.post("/encoderjob", (req, res, next) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ message: "videoId is required" });
    }

    if (currentJob.status === "idle") {
        currentJob.videoId = videoId
        currentJob.status = "processing"
        console.log("Video Processing Started... Stage 1 : Started ");
        next()
    } else {
        return res.json({ "MSG": "Server is Not Free" })
    }
}, processervideocontroller, (req, res, next) => {
    currentJob.status = "idle"
    console.log("Video Transcoding Stage Done...");
});


app.get("/status", (req, res) => {
    if (currentJob.status === "idle") {
        return res.status(200).json({ "MSG": "idle" });
    } else {
        return res.json({ "MSG": "Server is Not Free" })
    }
});

// Cron job to process waiting videos
cron.schedule('*/1 * * * *', async () => {
    console.log("Background service running - Checking for 'Waiting' videos");

    try {
        // Find all videos with status "Waiting"
        const waitingVideos = await Video.find({ status: "Waiting" });
        console.log(waitingVideos)
        for (const video of waitingVideos) {
            // Ensure no current job is processing
            if (currentJob.status === "idle") {
                currentJob.videoId = video._id;
                currentJob.status = "processing";
                await processVideo(video._id);
                currentJob.status = "idle"; // Reset status after processing
            } else {
                console.log("Server is busy processing another video");
            }
        }
    } catch (error) {
        console.error("Error in background service:", error);
    } finally {
        currentJob.status = "idle"
        console.log("Video Transcoding Stage Done...");
    }
});


export { app }