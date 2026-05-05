const User = require('../model/User');
const Admin = require('../model/Admin');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendOTPEmail, sendAdminPasswordResetEmail, sendContactFormEmail } = require('../utils/emailHelper');
const fs = require('fs');
const path = require('path');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({ email, otp, otpExpiry });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    }

    // Send OTP via email using the utility
    await sendOTPEmail(email, otp);
    
    console.log(`[DEVELOPMENT] Email sent to ${email} with OTP: ${otp}`);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      process.env.JWT_SECRET || 'fallback_secret_key', 
      { expiresIn: '7d' }
    );

    res.status(200).json({ message: "Verified successfully", token });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Google token is required" });

    // Decode Google JWT without strict verification for simplicity
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const email = decoded.email;
    // Extract name with multiple fallbacks
    const googleName = decoded.name || decoded.given_name || (decoded.family_name ? `${decoded.given_name} ${decoded.family_name}` : null);
    const profilePicture = decoded.picture;

    // Use email prefix as final fallback for name
    const finalName = googleName || email.split('@')[0];

    console.log(`[DEBUG] Google Auth Payload:`, JSON.stringify(decoded, null, 2));

    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({ 
        email, 
        name: finalName,
        profilePicture 
      });
      console.log(`[DEBUG] Created new user: ${user.email} with name: ${user.name}`);
    } else {
      // Always sync name if it's generic or missing
      if (!user.name || user.name === "User" || user.name === "Member") {
        user.name = finalName;
      }
      
      // Update profile picture if missing or not a custom upload
      if (profilePicture && (!user.profilePicture || !user.profilePicture.includes('/uploads/'))) {
        user.profilePicture = profilePicture;
      }
      
      await user.save();
      console.log(`[DEBUG] Synced existing user: ${user.email} with name: ${user.name}`);
    }

    const localToken = jwt.sign(
      { id: user.id, email: user.email }, 
      process.env.JWT_SECRET || 'fallback_secret_key', 
      { expiresIn: '7d' }
    );

    res.status(200).json({ message: "Google Auth successful", token: localToken });
  } catch (error) {
    console.error("Error in googleAuth:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phoneNumber', 'profilePicture']
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    
    await user.save();
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image provided" });
    }
    
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete old profile picture if it's a local file
    if (user.profilePicture && user.profilePicture.includes('/uploads/avatar/')) {
      const oldFilename = user.profilePicture.split('/uploads/avatar/')[1];
      if (oldFilename) {
        const oldFilePath = path.join(__dirname, '../uploads/avatar', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err) {
            console.error("Failed to delete old avatar:", err);
          }
        }
      }
    }

    // The image path relative to the server
    const imageUrl = `/uploads/avatar/${req.file.filename}`;
    user.profilePicture = imageUrl;
    await user.save();

    res.json({ message: "Profile picture updated", imageUrl });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body; // email is used as identifier (username or email)
    const admin = await Admin.findOne({ 
      where: { 
        [Op.or]: [
          { email: email },
          { name: email }
        ]
      } 
    });
    
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' }, 
      process.env.JWT_SECRET || 'fallback_secret_key', 
      { expiresIn: '1d' }
    );

    res.json({ message: "Admin logged in", token });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminProfile = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access forbidden: Admins only" });
    }

    const admin = await Admin.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'profilePicture']
    });
    
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json(admin);
  } catch (error) {
    console.error("Admin profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

    const { name, email, password, oldPassword } = req.body;
    const admin = await Admin.findByPk(req.user.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (password) {
      if (!oldPassword) {
        return res.status(400).json({ message: "Old password is required to change password." });
      }
      const isMatch = await bcrypt.compare(oldPassword, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect old password." });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
    }

    await admin.save();
    res.json({ 
      message: "Profile updated successfully", 
      admin: { id: admin.id, name: admin.name, email: admin.email, profilePicture: admin.profilePicture } 
    });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAdminProfilePicture = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admins only" });
    if (!req.file) return res.status(400).json({ message: "No image provided" });
    
    const admin = await Admin.findByPk(req.user.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Delete old profile picture if it's a local file
    if (admin.profilePicture && admin.profilePicture.includes('/uploads/avatar/')) {
      const oldFilename = admin.profilePicture.split('/uploads/avatar/')[1];
      if (oldFilename) {
        const oldFilePath = path.join(__dirname, '../uploads/avatar', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath); } catch (err) { console.error(err); }
        }
      }
    }

    const imageUrl = `/uploads/avatar/${req.file.filename}`;
    admin.profilePicture = imageUrl;
    await admin.save();

    res.json({ message: "Admin profile picture updated", imageUrl });
  } catch (error) {
    console.error("Error updating admin profile picture:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: "Admin not found with this email" });

    const otp = generateOTP();
    admin.otp = otp;
    admin.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await admin.save();

    await sendAdminPasswordResetEmail(admin.email, otp);
    console.log(`[DEVELOPMENT] Admin reset OTP sent to ${email}: ${otp}`);

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (!admin.otp || admin.otp !== otp || admin.otpExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    admin.otp = null;
    admin.otpExpiry = null;
    await admin.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.submitContact = async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;
    if (!firstName || !email || !message) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Get the first admin's email to receive the contact form
    const admin = await Admin.findOne();
    if (!admin) {
      return res.status(500).json({ message: "Admin not found to receive message" });
    }

    const adminEmail = admin.email;

    await sendContactFormEmail(adminEmail, { firstName, lastName, email, message });
    res.json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};
