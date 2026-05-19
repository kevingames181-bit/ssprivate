import { query, transaction } from './db';
import type { User, Device } from '../types';

export async function createUser(user: User): Promise<User> {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO users (id, email, password_hash, user_key, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, user.email, user.passwordHash, user.userKey, user.role, user.createdAt]
    );

    for (const device of user.devices) {
      await client.query(
        `INSERT INTO devices (id, user_id, name, device_key_hash, device_key_encrypted, last_used, created_at, is_active, ip_address, user_agent, refresh_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          device.id, user.id, device.name, device.deviceKeyHash,
          device.deviceKeyEncrypted, device.lastUsed, device.createdAt,
          device.isActive, device.ipAddress || null, device.userAgent || null,
          device.refreshToken || null
        ]
      );
    }

    return rowToUser(result.rows[0], user.devices);
  });
}

export async function getUserById(id: string): Promise<User | null> {
  const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
  if (userResult.rows.length === 0) return null;

  const devicesResult = await query('SELECT * FROM devices WHERE user_id = $1', [id]);
  return rowToUser(userResult.rows[0], devicesResult.rows.map(rowToDevice));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (userResult.rows.length === 0) return null;

  const devicesResult = await query('SELECT * FROM devices WHERE user_id = $1', [userResult.rows[0].id]);
  return rowToUser(userResult.rows[0], devicesResult.rows.map(rowToDevice));
}

export async function getUserByUserKey(userKey: string): Promise<User | null> {
  const userResult = await query('SELECT * FROM users WHERE user_key = $1', [userKey]);
  if (userResult.rows.length === 0) return null;

  const devicesResult = await query('SELECT * FROM devices WHERE user_id = $1', [userResult.rows[0].id]);
  return rowToUser(userResult.rows[0], devicesResult.rows.map(rowToDevice));
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  return transaction(async (client) => {
    if (updates.devices) {
      for (const device of updates.devices) {
        await client.query(
          `INSERT INTO devices (id, user_id, name, device_key_hash, device_key_encrypted, last_used, created_at, is_active, ip_address, user_agent, refresh_token)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             last_used = EXCLUDED.last_used,
             is_active = EXCLUDED.is_active,
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent,
             refresh_token = EXCLUDED.refresh_token`,
          [
            device.id, id, device.name, device.deviceKeyHash,
            device.deviceKeyEncrypted, device.lastUsed, device.createdAt,
            device.isActive, device.ipAddress || null, device.userAgent || null,
            device.refreshToken || null
          ]
        );
      }
    }

    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) return null;

    const devicesResult = await client.query('SELECT * FROM devices WHERE user_id = $1', [id]);
    return rowToUser(userResult.rows[0], devicesResult.rows.map(rowToDevice));
  });
}

export async function updateStripeCustomer(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<void> {
  await query(
    `UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3`,
    [stripeCustomerId, stripeSubscriptionId || null, userId]
  );
}

export async function updateSubscriptionTier(userId: string, tier: string, stripeSubscriptionId: string): Promise<void> {
  await query(
    `UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3`,
    [tier, stripeSubscriptionId, userId]
  );
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const userResult = await query('SELECT * FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
  if (userResult.rows.length === 0) return null;

  const devicesResult = await query('SELECT * FROM devices WHERE user_id = $1', [userResult.rows[0].id]);
  return rowToUser(userResult.rows[0], devicesResult.rows.map(rowToDevice));
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await query('DELETE FROM users WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

function rowToUser(row: any, devices: Device[]): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    userKey: row.user_key,
    role: row.role,
    createdAt: row.created_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionTier: row.subscription_tier || 'free',
    devices,
  };
}

function rowToDevice(row: any): Device {
  return {
    id: row.id,
    name: row.name,
    deviceKeyHash: row.device_key_hash,
    deviceKeyEncrypted: row.device_key_encrypted,
    lastUsed: row.last_used,
    createdAt: row.created_at,
    isActive: row.is_active,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    refreshToken: row.refresh_token,
  };
}
