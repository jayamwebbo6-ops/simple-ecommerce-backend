const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const convertToWebp = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'product-' + uniqueSuffix + '.webp';
    const outputPath = path.join(uploadDir, filename);

    // Convert memory buffer to WebP with 80% quality
    await sharp(req.file.buffer)
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Update req.file details to reflect the newly saved WebP file
    req.file.filename = filename;
    req.file.path = outputPath;
    req.file.destination = uploadDir;
    req.file.mimetype = 'image/webp';

    next();
  } catch (error) {
    next(error);
  }
};

const productUpload = {
  upload,
  convertToWebp,
  single: (fieldName) => {
    const uploadSingle = upload.single(fieldName);
    return (req, res, next) => {
      uploadSingle(req, res, (err) => {
        if (err) {
          return next(err);
        }
        convertToWebp(req, res, next);
      });
    };
  }
};

module.exports = productUpload;

