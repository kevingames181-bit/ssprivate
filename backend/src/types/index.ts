export interface User {
  id: string;
  email: string;
  passwordHash: string;
  userKey: string;
  role: 'admin' | 'staff' | 'user';
  createdAt: string;
  devices: Device[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier?: 'free' | 'professional' | 'enterprise';
}

export interface Device {
  id: string;
  name: string;
  deviceKeyHash: string; // Hashed device key
  deviceKeyEncrypted: string; // Encrypted device key for storage
  lastUsed: string;
  createdAt: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  refreshToken?: string;
}

export interface JWTPayload {
  userId: string;
  userKey: string;
  deviceId: string;
  role: 'admin' | 'staff' | 'user';
}

export interface RegisterRequest {
  email: string;
  password: string;
  deviceName?: string;
}

export interface LoginRequest {
  userKey: string;
  deviceKey: string;
}

export interface AddDeviceRequest {
  userKey: string;
  password: string;
  deviceName: string;
}
