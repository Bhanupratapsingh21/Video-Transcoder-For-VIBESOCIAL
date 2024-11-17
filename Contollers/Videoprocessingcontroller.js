import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Video } from '../models/Video.model.js';
import axios from "axios";
import { fileURLToPath } from 'url';
import uploadFolderToS3 from '../utils/uplaodonawss3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deleteFiles = (filePaths) => {
    filePaths.forEach((filePath) => {
        fs.rm(filePath, { recursive: true, force: true }, (err) => {
            if (err) console.error(`Error deleting ${filePath}:`, err);
            else console.log(`Deleted ${filePath}`);
        });
    });
};

const processervideocontroller = async (req, res, next) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ message: "videoId is required" });
    }

    const video = await Video.findByIdAndUpdate(videoId, { status: "Processing" });
    if (!video) {
        return res.status(404).json({ message: "Video Not Found" });
    }
    if (video.status !== "Waiting") {
        return res.status(404).json({ message: `Video is in the ${video.status}` });
    }

    console.log("Video Processing Started... Stage 1 : Done");

    let videoPath;
    const outputPath = path.join(__dirname, '..', 'uploads', 'videos', videoId);

    try {
        console.log("Download from Database Started... Stage 2 : Started");

        const response = await axios({
            method: 'get',
            url: video.videoFile.cloudinaryUrl,
            responseType: 'stream'
        });

        const downloadedVideoPath = path.resolve(__dirname, '..', 'public', 'cloudinary', 'downloadedVideo.mp4');
        videoPath = downloadedVideoPath;

        const writer = fs.createWriteStream(downloadedVideoPath);
        response.data.pipe(writer);

        writer.on('finish', async () => {
            console.log("Video Download from Database... Stage 2 : Done");

            console.log("Encoding Part Stage 3 : Started...");
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }

            const ffmpegCommand = `ffmpeg -i "${videoPath}" ` +
                `-filter:v:0 scale=w=426:h=240 -c:v:0 libx264 -c:a:0 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/240p_segment%03d.ts" "${outputPath}/240p.m3u8" ` +
                `-filter:v:1 scale=w=640:h=460 -c:v:1 libx264 -c:a:1 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/460p_segment%03d.ts" "${outputPath}/460p.m3u8" ` +
                `-filter:v:2 scale=w=1280:h=720 -c:v:2 libx264 -c:a:2 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/720p_segment%03d.ts" "${outputPath}/720p.m3u8"`;

            exec(ffmpegCommand, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`FFmpeg error: ${error}`);
                    return res.status(500).json({ "error": "Video processing failed" });
                }

                console.log("Encoding Done Stage 3 : Done");
                console.log("Uploading Folder To S3 Cloud Stage 4 : Started...");
                try {
                    const bucketName = process.env.S3_BUCKET_NAME;
                    const prefix = `videos/${videoId}`;
                    const s3Urls = await uploadFolderToS3(outputPath, bucketName, prefix);

                    console.log("Uploading Folder To S3 Cloud Stage 4 : Done");
                    console.log("Updating Db Stage 5 : Started...");
                    await Video.findByIdAndUpdate(videoId, {
                        status: "Done",
                        videoFile: {
                            cloudinaryUrl: video.videoFile.cloudinaryUrl,
                            encodedUrl: s3Urls
                        }
                    });
                    console.log("Updating Db Stage 5 : Done...");

                    res.status(201).json({
                        "MSG": "HLS generation and upload to S3 completed",
                        s3Urls,
                        videoId
                    });
                    console.log("Video Uploaded Successfully...");

                    // Cleanup downloaded and processed files
                    deleteFiles([downloadedVideoPath, outputPath]);

                } catch (uploadError) {
                    console.error("Error uploading to S3", uploadError);
                    res.status(500).json({ message: "Error uploading video to S3" });
                }
            });
        });

        writer.on('error', (err) => {
            console.log("Error writing the file:", err);
            res.status(500).json({ message: "Error downloading video" });
        });

    } catch (error) {
        console.log("Error downloading the video, exiting process", error);
        await Video.findByIdAndUpdate(videoId, {
            status: "Waiting",
        });
        console.log("Error DB Stage 4 : Error");
        res.status(500).json({ message: "Error downloading video" });
    } finally {
        next();
    }
};

export default processervideocontroller;
