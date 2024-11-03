import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const uploadFolderToS3 = async (folderPath, bucketName, prefix) => {
    const files = fs.readdirSync(folderPath);
    const uploadedUrls = {};

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const fileContent = fs.readFileSync(filePath);

        const params = {
            Bucket: bucketName,
            Key: `${prefix}/${file}`, // Path in S3 bucket
            Body: fileContent,
            ContentType: 'application/vnd.apple.mpegurl', // MIME type for .m3u8 and .ts files
        };

        // Upload each file
        const uploadResult = await s3.upload(params).promise();
        console.log(`Uploaded ${file}`);
        // console.log(`Uploaded ${file} to ${uploadResult.Location}`);

        // Map resolution to S3 URL
        if (file.includes('240p')) {
            uploadedUrls['240p'] = uploadResult.Location;
        } else if (file.includes('460p')) {
            uploadedUrls['460p'] = uploadResult.Location;
        } else if (file.includes('720p')) {
            uploadedUrls['720p'] = uploadResult.Location;
        }
    }

    return uploadedUrls;
};

export default uploadFolderToS3
