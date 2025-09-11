const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({origin: true});

admin.initializeApp();

// --- Configure Your Email Service ---
// IMPORTANT: For production, use a dedicated service like SendGrid.
// For this project, we'll use Gmail with an "App Password".
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "achintkiran2701@gmail.com",
        pass: "xjxn nflj mhlt ggwn" 
    },
});

exports.sendOtp = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({ error: "Email is required." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        const mailOptions = {
            from: "PESU Biotech Labs <YOUR_GMAIL_ADDRESS@gmail.com>",
            to: email,
            subject: "Your Lab Booking Verification Code",
            text: `Your verification code is: ${otp}`,
        };

        try {
            const otpRef = admin.firestore().collection("otps").doc(email);
            await otpRef.set({
                code: otp,
                expires: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
            });

            await transporter.sendMail(mailOptions);
            res.status(200).send({ success: true, message: "OTP sent successfully." });
        } catch (error) {
            console.error("Error sending OTP:", error);
            res.status(500).send({ error: "Failed to send OTP." });
        }
    });
});

exports.verifyOtp = functions.https.onRequest(async (req, res) => {
     cors(req, res, async () => {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).send({ error: "Email and OTP are required." });
        }

        const otpRef = admin.firestore().collection("otps").doc(email);

        try {
            const doc = await otpRef.get();
            if (!doc.exists) {
                return res.status(400).send({ error: "Invalid OTP or expired." });
            }

            const data = doc.data();
            if (data.expires.toMillis() < Date.now()) {
                return res.status(400).send({ error: "OTP has expired." });
            }

            if (data.code.toString() === otp.toString()) {
                await otpRef.delete();
                return res.status(200).send({ success: true });
            } else {
                return res.status(400).send({ error: "Invalid OTP." });
            }
        } catch (error) {
            console.error("Error verifying OTP:", error);
            res.status(500).send({ error: "Failed to verify OTP." });
        }
    });
});
