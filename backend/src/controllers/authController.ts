import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../database/userRepository';
import { generateKey, hashPassword, verifyPassword, encrypt } from '../utils/crypto';
import { generateAccessToken, generateRefreshToken, getTokenExpiresIn } from '../utils/jwt';
import type { User, Device, RegisterRequest, LoginRequest, AddDeviceRequest } from '../types';

/**
 * Register new user
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, deviceName }: RegisterRequest = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Generate keys
    const userId = uuidv4();
    const userKey = generateKey('USR');
    const deviceKey = generateKey('DEV');
    const deviceId = uuidv4();

    // Hash password and device key
    const passwordHash = await hashPassword(password);
    const deviceKeyHash = await hashPassword(deviceKey);
    const deviceKeyEncrypted = encrypt(deviceKey);

    // Create device
    const device: Device = {
      id: deviceId,
      name: deviceName || 'Primary Device',
      deviceKeyHash,
      deviceKeyEncrypted,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isActive: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    // Create user
    const user: User = {
      id: userId,
      email,
      passwordHash,
      userKey,
      role: 'user',
      createdAt: new Date().toISOString(),
      devices: [device],
    };

    await db.createUser(user);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      userKey: user.userKey,
      deviceId: device.id,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      userKey: user.userKey,
      deviceId: device.id,
      role: user.role,
    });

    // Store refresh token
    device.refreshToken = await hashPassword(refreshToken);
    await db.updateUser(user.id, { devices: [device] });

    res.status(201).json({
      user: sanitizeUser(user),
      userKey,
      deviceKey,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: getTokenExpiresIn(),
      },
      message: 'Registration successful',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Login with User Key + Device Key
 */
export async function login(req: Request, res: Response) {
  try {
    const { userKey, deviceKey }: LoginRequest = req.body;

    if (!userKey || !deviceKey) {
      return res.status(400).json({ message: 'User key and device key are required' });
    }

    // Find user by user key
    const user = await db.getUserByUserKey(userKey);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Find device with matching device key
    let matchedDevice: Device | null = null;
    for (const device of user.devices) {
      if (device.isActive && await verifyPassword(deviceKey, device.deviceKeyHash)) {
        matchedDevice = device;
        break;
      }
    }

    if (!matchedDevice) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update device last used
    matchedDevice.lastUsed = new Date().toISOString();
    matchedDevice.ipAddress = req.ip;
    matchedDevice.userAgent = req.get('user-agent');

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      userKey: user.userKey,
      deviceId: matchedDevice.id,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      userKey: user.userKey,
      deviceId: matchedDevice.id,
      role: user.role,
    });

    // Store refresh token
    matchedDevice.refreshToken = await hashPassword(refreshToken);
    await db.updateUser(user.id, { devices: user.devices });

    res.json({
      user: sanitizeUser(user),
      device: sanitizeDevice(matchedDevice),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: getTokenExpiresIn(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Add new device to existing user
 */
export async function addDevice(req: Request, res: Response) {
  try {
    const { userKey, password, deviceName }: AddDeviceRequest = req.body;
    const userId = (req as any).user.userId;

    if (!userKey || !password || !deviceName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Get user
    const user = await db.getUserById(userId);
    if (!user || user.userKey !== userKey) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate new device key
    const deviceKey = generateKey('DEV');
    const deviceId = uuidv4();
    const deviceKeyHash = await hashPassword(deviceKey);
    const deviceKeyEncrypted = encrypt(deviceKey);

    // Create new device
    const newDevice: Device = {
      id: deviceId,
      name: deviceName,
      deviceKeyHash,
      deviceKeyEncrypted,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isActive: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    user.devices.push(newDevice);
    await db.updateUser(user.id, { devices: user.devices });

    res.status(201).json({
      device: sanitizeDevice(newDevice),
      deviceKey,
      message: 'Device added successfully',
    });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get all devices for current user
 */
export async function getDevices(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;

    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      devices: user.devices.map(sanitizeDevice),
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Revoke device access
 */
export async function revokeDevice(req: Request, res: Response) {
  try {
    const { deviceId } = req.body;
    const userId = (req as any).user.userId;
    const currentDeviceId = (req as any).user.deviceId;

    if (!deviceId) {
      return res.status(400).json({ message: 'Device ID is required' });
    }

    if (deviceId === currentDeviceId) {
      return res.status(400).json({ message: 'Cannot revoke current device' });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const device = user.devices.find(d => d.id === deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    device.isActive = false;
    device.refreshToken = undefined;
    await db.updateUser(user.id, { devices: user.devices });

    res.json({ message: 'Device revoked successfully' });
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Logout current device
 */
export async function logout(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const deviceId = (req as any).user.deviceId;

    const user = await db.getUserById(userId);
    if (user) {
      const device = user.devices.find(d => d.id === deviceId);
      if (device) {
        device.refreshToken = undefined;
        await db.updateUser(user.id, { devices: user.devices });
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;

    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Sanitize user object (remove sensitive data)
 */
function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    userKey: user.userKey,
    role: user.role,
    createdAt: user.createdAt,
    devices: user.devices.map(sanitizeDevice),
  };
}

/**
 * Sanitize device object (remove sensitive data)
 */
function sanitizeDevice(device: Device) {
  return {
    id: device.id,
    name: device.name,
    lastUsed: device.lastUsed,
    createdAt: device.createdAt,
    isActive: device.isActive,
    ipAddress: device.ipAddress,
    userAgent: device.userAgent,
  };
}
