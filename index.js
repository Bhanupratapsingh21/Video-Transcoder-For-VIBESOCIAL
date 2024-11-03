import dotenv from 'dotenv'
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({
    path: "./.env"
})

// 2nd approch with db index.js then =>

connectDB()
    .then(() => {

        app.on("error", (error) => {
            console.log("error not able to listin", error);
        })

        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server iS Running At Port ${process.env.PORT}`)
        })
    })
    .catch(
        (err) => {
            console.log("moogoDb connenation failed !! ::", err)
        })
