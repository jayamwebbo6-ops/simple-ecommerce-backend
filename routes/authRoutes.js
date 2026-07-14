const express = require('express');
const { sendOtp, verifyOtp, googleAuth, getProfile, updateProfile, updateProfilePicture, adminLogin, getAdminProfile, updateAdminProfile, updateAdminProfilePicture, adminForgotPassword, adminResetPassword, submitContact, getAdminContactInfo } = require('../controller/authController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google', googleAuth);

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/profile/picture', authMiddleware, uploadMiddleware.single('image'), updateProfilePicture);

// Admin routes
router.post('/admin/login', adminLogin);
router.get('/admin/profile', authMiddleware, getAdminProfile);
router.put('/admin/profile', authMiddleware, updateAdminProfile);
router.post('/admin/profile/picture', authMiddleware, uploadMiddleware.single('image'), updateAdminProfilePicture);
router.post('/admin/forgot-password', adminForgotPassword);
router.post('/admin/reset-password', adminResetPassword);

// Public settings routes
router.get('/admin/contact-info', getAdminContactInfo);

// Contact Form
router.post('/contact', submitContact);

module.exports = router;
