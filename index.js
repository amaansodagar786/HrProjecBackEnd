const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS configuration
app.use(cors({
    origin: 'https://hr-project-front-end.vercel.app', // replace with your frontend's domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Create the upload directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 10, // 10 MB limit example
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
}).single('resume');

// MongoDB connection
mongoose
    .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log("MongoDB connection error:", err));

// MongoDB schemas
const ContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    service: { type: String, required: true },
    message: { type: String, required: true },
});

const ApplicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String, required: true },
    message: { type: String },
    resume: { type: String, required: true }
});

const User = mongoose.model("HRContactData", ContactSchema);
const Application = mongoose.model("CareerApplication", ApplicationSchema);

// Contact form handler
app.post("/contact", async (req, res) => {
    const { name, email, mobile, service, message } = req.body;

    try {
        const result = await User.create({ name, email, mobile, service, message });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Email to the client/user
        const clientMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Welcome to HR web',
            html: `<p>Hello ${name}</p><p>Thank you for contacting us</p><p>Best regards,<br>Team NAOH</p>`,
        };

        // Email to the owner
        const ownerMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New Contact Form Submission',
            html: `<p>You have a new contact form submission:</p><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mobile:</strong> ${mobile}</p><p><strong>Service:</strong> ${service}</p><p><strong>Message:</strong> ${message}</p>`,
        };

        // Send emails
        await transporter.sendMail(clientMailOptions);
        await transporter.sendMail(ownerMailOptions);

        res.json({ success: true, message: 'Added to contact list' });
    } catch (error) {
        console.error('Error adding to contact list:', error);
        res.status(500).json({ success: false, error: 'Failed to add to contact list' });
    }
});

// Career application handler
app.post("/career", (req, res) => {
    upload(req, res, async function (err) {
        if (err instanceof multer.MulterError || err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        // File not received
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { name, phone, email, position, message } = req.body;
        const resume = req.file.filename;

        try {
            const result = await Application.create({ name, phone, email, position, message, resume });

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            // Email to the applicant
            const applicantMailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Application Received',
                html: `<p>Hello ${name},</p><p>Thank you for applying for the ${position} position. We have received your application and will get back to you soon.</p><p>Best regards,<br>Team NAOH</p>`,
            };

            // Email to the owner with resume attached
            const ownerMailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'New Career Application',
                html: `<p>You have a new career application:</p><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Position:</strong> ${position}</p><p><strong>Message:</strong> ${message}</p>`,
                attachments: [
                    {
                        filename: req.file.originalname,
                        path: path.join(__dirname, 'uploads', resume),
                    }
                ],
            };

            // Send emails
            await transporter.sendMail(applicantMailOptions);
            await transporter.sendMail(ownerMailOptions);

            res.json({ success: true, message: 'Application submitted successfully' });
        } catch (error) {
            console.error('Error submitting application:', error);
            res.status(500).json({ success: false, error: 'Failed to submit application', details: error.message });
        }
    });
});

// Default route
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Start the server
app.listen(3037, () => {
    console.log('Server connected on port 3037');
});
