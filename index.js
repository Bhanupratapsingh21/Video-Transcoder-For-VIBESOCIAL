import express, { json, urlencoded } from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

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

app.post("/upload", upload.single('file'), (req, res) => {
    console.log("File uploaded");

    const videoId = uuidv4();
    const videoPath = req.file.path;
    const outputPath = `./uploads/videos/${videoId}`;
    const hlsPath = `${outputPath}/index.m3u8`;

    // Ensure the output directory exists
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }

    const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe'; // Full path to ffmpeg

    // FFmpeg command to generate HLS streams at different resolutions
    const ffmpegCommand = `${ffmpegPath} -i ${videoPath} ` +
        `-filter:v:0 scale=w=426:h=240 -c:v:0 libx264 -c:a:0 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/240p_segment%03d.ts" ${outputPath}/240p.m3u8 ` +
        `-filter:v:1 scale=w=640:h=460 -c:v:1 libx264 -c:a:1 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/460p_segment%03d.ts" ${outputPath}/460p.m3u8 ` +
        `-filter:v:2 scale=w=1280:h=720 -c:v:2 libx264 -c:a:2 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/720p_segment%03d.ts" ${outputPath}/720p.m3u8`;

    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.log(`exec error: ${error}`);
            return res.status(500).json({ "error": "Video processing failed" });
        }

        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        const videoUrls = {
            "240p": `http://localhost:4000/uploads/videos/${videoId}/240p.m3u8`,
            "460p": `http://localhost:4000/uploads/videos/${videoId}/460p.m3u8`,
            "720p": `http://localhost:4000/uploads/videos/${videoId}/720p.m3u8`
        };

        res.status(201).json({
            "MSG": "HLS generation completed",
            videoUrls,
            videoId
        });
    });
});

// Start server
app.listen(4000, () => {
    console.log(`Server is running at PORT 4000`);
});
