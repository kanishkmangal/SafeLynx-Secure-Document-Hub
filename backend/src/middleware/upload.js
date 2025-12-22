const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    const isPDF = file.mimetype === "application/pdf";

    // IMAGES
    if (isImage) {
      return {
        folder: "safelynx",
        resource_type: "image",
        access_mode: "public",
        use_filename: true,
        unique_filename: true,
      };
    }

    // PDF
    if (isPDF) {
      return {
        folder: "safelynx",
        resource_type: "raw",
        access_mode: "public",
        public_id:
          file.originalname.replace(/\.[^/.]+$/, "") +
          "_" +
          Date.now() +
          ".pdf",
      };
    }

    // DOC, DOCX, XLS, TXT etc
    return {
      folder: "safelynx",
      resource_type: "raw",
      access_mode: "public",
      public_id:
        file.originalname.replace(/\.[^/.]+$/, "") +
        "_" +
        Date.now() +
        path.extname(file.originalname),
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
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  cb(allowed.includes(file.mimetype) ? null : new Error("Unsupported file type"), allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;
