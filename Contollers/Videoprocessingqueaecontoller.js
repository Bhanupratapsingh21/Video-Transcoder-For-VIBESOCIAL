import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Video } from '../models/Video.model.js';
import axios from 'axios';
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

// Function to process the video
export const processVideo = async (videoId) => {
    const video = await Video.findById(videoId);

    if (!video) {
        throw new Error("Video Not Found");
    }

    if (video.status !== "Waiting") {
        throw new Error(`Video is in the ${video.status}`);
    }

    await Video.findByIdAndUpdate(videoId, { status: "Processing" });
    console.log("Video Processing Started...");

    const outputPath = path.join(__dirname, '..', 'uploads', 'videos', videoId.toString());
    const downloadedVideoPath = path.resolve(__dirname, '..', 'public', 'cloudinary', 'downloadedVideo.mp4');

    try {
        console.log("Downloading video...");
        const response = await axios.get(video.videoFile.cloudinaryUrl, { responseType: 'stream' });
        const writer = fs.createWriteStream(downloadedVideoPath);
        response.data.pipe(writer);

        writer.on('finish', async () => {
            console.log("Video Download Completed. Starting Encoding...");

            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }

            const ffmpegCommand = `ffmpeg -i "${downloadedVideoPath}" ` +
                `-filter:v:0 scale=w=426:h=240 -c:v:0 libx264 -c:a:0 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/240p_segment%03d.ts" "${outputPath}/240p.m3u8" ` +
                `-filter:v:1 scale=w=640:h=460 -c:v:1 libx264 -c:a:1 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/460p_segment%03d.ts" "${outputPath}/460p.m3u8" ` +
                `-filter:v:2 scale=w=1280:h=720 -c:v:2 libx264 -c:a:2 aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/720p_segment%03d.ts" "${outputPath}/720p.m3u8"`;

            exec(ffmpegCommand, async (error) => {
                if (error) {
                    throw new Error("Video processing failed");
                }

                console.log("Encoding Done. Uploading to S3...");
                const bucketName = process.env.S3_BUCKET_NAME;
                const prefix = `videos/${videoId}`;
                const s3Urls = await uploadFolderToS3(outputPath, bucketName, prefix);

                await Video.findByIdAndUpdate(videoId, {
                    status: "Done",
                    videoFile: {
                        cloudinaryUrl: video.videoFile.cloudinaryUrl,
                        encodedUrl: s3Urls
                    }
                });

                console.log("Video Uploaded Successfully. Cleaning up...");
                deleteFiles([downloadedVideoPath, outputPath]);
            });
        });

        writer.on('error', (err) => {
            throw new Error("Error writing the file: " + err.message);
        });

    } catch (error) {
        console.error("Error in processing video:", error);
        await Video.findByIdAndUpdate(videoId, { status: "Waiting" }); // Reset status in case of error
        throw new Error("Error in downloading or processing video");
    }
};
