const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Campaign = require('../models/Campaign');

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status
});

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'name, email, and password are required'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({
        message: 'A user with that email already exists'
      });
    }

    const userCount = await User.countDocuments();
    const isAdmin = userCount === 0;

    const user = await User.create({
      name,
      email,
      password,
      role: isAdmin ? 'Admin' : 'User',
      status: isAdmin ? 'approved' : 'pending',
      approvedAt: isAdmin ? new Date() : null
    });

    if (isAdmin) {
      return res.status(201).json({
        token: signToken(user),
        user: formatUser(user)
      });
    }

    return res.status(201).json({
      message: 'Account created successfully. Please wait for admin approval before logging in.',
      user: formatUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A user with that email already exists'
      });
    }

    return res.status(500).json({
      message: 'Unable to register user',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'email and password are required'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase()
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        message: 'Your account is pending approval. Please contact the admin.',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        message: 'Your account has been rejected. Please contact the admin.',
        status: 'rejected'
      });
    }

    return res.json({
      token: signToken(user),
      user: formatUser(user)
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to log in',
      error: error.message
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user: formatUser(user) });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch user',
      error: error.message
    });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'User', status: 'pending' }).sort({ createdAt: -1 });
    return res.json({ users: users.map(formatUser) });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch pending users',
      error: error.message
    });
  }
};

const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'Admin') {
      return res.status(400).json({ message: 'Cannot approve an admin user' });
    }
    user.status = 'approved';
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();
    return res.json({ message: 'User approved successfully', user: formatUser(user) });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to approve user',
      error: error.message
    });
  }
};

const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'Admin') {
      return res.status(400).json({ message: 'Cannot reject an admin user' });
    }
    user.status = 'rejected';
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();
    return res.json({ message: 'User rejected', user: formatUser(user) });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to reject user',
      error: error.message
    });
  }
};

const getEmployees = async (req, res) => {
  try {
    const users = await User.find({ role: 'User', status: 'approved' }).sort({ name: 1 });
    const result = await Promise.all(
      users.map(async (u) => {
        const campaignCount = await Campaign.countDocuments({ userId: u._id });
        return { ...formatUser(u), campaignCount };
      })
    );
    return res.json({ users: result });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch employees',
      error: error.message
    });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'Admin') {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const campaignCount = await Campaign.countDocuments({ userId: user._id });
    return res.json({ user: { ...formatUser(user), campaignCount } });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch employee',
      error: error.message
    });
  }
};

const getEmployeeCampaigns = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'Admin') {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const campaigns = await Campaign.find({ userId: user._id })
      .populate('selectedDomains', 'domainName senderEmail senderName status')
      .sort({ createdAt: -1 });
    return res.json({ campaigns });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch employee campaigns',
      error: error.message
    });
  }
};

const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';

    let token = '';

    if (authorization.startsWith('Bearer ')) {
      token = authorization.slice('Bearer '.length);
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        message: 'Authorization token is required'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required');
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(401).json({
        message: 'User no longer exists'
      });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        message: 'Account is not approved. Please contact the admin.',
        status: user.status
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        message: 'Invalid or expired authorization token'
      });
    }

    return res.status(500).json({
      message: 'Unable to authenticate request',
      error: error.message
    });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({
      message: 'Admin access is required'
    });
  }

  return next();
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'Admin') {
      return res.status(400).json({ message: 'Cannot delete an admin user' });
    }
    await Campaign.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);
    return res.json({ message: `User "${user.name}" and all their campaigns have been deleted.` });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to delete user',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getPendingUsers,
  approveUser,
  rejectUser,
  getEmployees,
  getEmployeeById,
  getEmployeeCampaigns,
  deleteUser,
  protect,
  adminOnly
};
