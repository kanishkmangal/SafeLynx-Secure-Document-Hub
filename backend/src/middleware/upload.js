const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPDF = file.mimetype === "application/pdf";
    const isImage = file.mimetype.startsWith('image/');

    if (isPDF) {
      return {
        folder: "safelynx",
        resource_type: "image",
        format: "pdf",
        use_filename: true,
        unique_filename: true,
        access_control: [{ access_type: "anonymous" }],
      };
    }

    if (isImage) {
      return {
        folder: "safelynx",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        access_control: [{ access_type: "anonymous" }],
      };
    }

    // Default for DOC, DOCX, XLS, etc. -> RAW
    return {
      folder: "safelynx",
      resource_type: "raw",
      // Explicitly append extension to public_id for Raw files to ensure accessible URL
      public_id: file.originalname.replace(/\.[^/.]+$/, "") + "_" + Date.now() + path.extname(file.originalname),
      use_filename: true,
      unique_filename: false, // Turn off unique_filename as we handle uniqueness manually in public_id
      access_control: [{ access_type: "anonymous" }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "text/plain",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

module.exports = upload;
