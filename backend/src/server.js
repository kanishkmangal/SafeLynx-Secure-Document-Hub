const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
connectDB();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://safe-lynx-secure-document-hub.vercel.app",
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.get("/", (req, res) => {
  res.send("Safelynx Backend is Live 🚀");
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ message: 'Server error', error: err.message });
  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Environment Check:", {
    NODE_ENV: process.env.NODE_ENV,
    CloudinaryNameSet: !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME),
    CloudinaryKeySet: !!process.env.CLOUDINARY_API_KEY,
    CloudinarySecretSet: !!process.env.CLOUDINARY_API_SECRET
  });
});

