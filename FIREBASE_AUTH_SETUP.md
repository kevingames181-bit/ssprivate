# Firebase Authentication Setup Guide

## Overview
SeaScope now uses Firebase Authentication for enterprise-grade user management with real account creation, password reset, email verification, and Google Sign-In.

## Features Implemented
- ✅ Real user registration with email/password
- ✅ Email verification
- ✅ Login with email/password
- ✅ Google Sign-In
- ✅ Password reset (forgot password)
- ✅ User profile storage in Firestore
- ✅ Secure token management
- ✅ Session persistence

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `seascope-alaska`
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication Methods

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"
3. Enable **Google**:
   - Click on "Google"
   - Toggle "Enable"
   - Enter support email
   - Click "Save"

### 3. Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in production mode"
4. Select location (choose closest to Alaska: `us-west2`)
5. Click "Enable"

### 4. Set Firestore Security Rules

Go to **Firestore Database** > **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Users can create their own profile during registration
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Users can update their own profile
      allow update: if request.auth != null && request.auth.uid == userId;
      
      // Only admins can delete (implement admin check as needed)
      allow delete: if false;
    }
    
    // Add other collections as needed
  }
}
```

### 5. Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click the web icon (`</>`)
4. Register app with nickname: `SeaScope Web`
5. Copy the configuration object

### 6. Update Environment Variables

Create or update `.env` file in the project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=seascope-alaska.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seascope-alaska
VITE_FIREBASE_STORAGE_BUCKET=seascope-alaska.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=652479698457
VITE_FIREBASE_APP_ID=1:652479698457:web:5603659ff20ba850b1fc88
VITE_FIREBASE_MEASUREMENT_ID=G-DQTV9CB3C9
```

### 7. Configure Email Templates (Optional)

1. Go to **Authentication** > **Templates**
2. Customize email templates for:
   - Email verification
   - Password reset
   - Email address change

## Usage in Code

### Using Firebase Auth Context

```typescript
import { useAuth } from './contexts/FirebaseAuthContext';

function MyComponent() {
  const { user, login, register, logout, resetPassword, loginWithGoogle } = useAuth();

  // Register new user
  const handleRegister = async () => {
    try {
      await register('user@example.com', 'password123', 'John Doe');
      // User is automatically logged in after registration
    } catch (error) {
      console.error(error.message);
    }
  };

  // Login
  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password123');
    } catch (error) {
      console.error(error.message);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error.message);
    }
  };

  // Forgot Password
  const handleForgotPassword = async () => {
    try {
      await resetPassword('user@example.com');
      alert('Password reset email sent!');
    } catch (error) {
      console.error(error.message);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error.message);
    }
  };

  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.displayName || user.email}!</p>
          <p>Email: {user.email}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={handleLogin}>Login</button>
          <button onClick={handleRegister}>Register</button>
          <button onClick={handleGoogleSignIn}>Sign in with Google</button>
        </div>
      )}
    </div>
  );
}
```

## User Profile Structure

User profiles are stored in Firestore at `/users/{uid}`:

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string; // 'user', 'admin', etc.
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  emailVerified: boolean;
}
```

## Security Features

1. **Email Verification**: Users receive verification email after registration
2. **Password Requirements**: Minimum 6 characters (configurable in Firebase)
3. **Rate Limiting**: Firebase automatically rate limits authentication attempts
4. **Secure Tokens**: JWT tokens managed by Firebase
5. **Session Persistence**: Users stay logged in across browser sessions
6. **HTTPS Only**: All Firebase communication is encrypted

## Migration from Old Auth System

To migrate from the old backend auth system to Firebase:

1. Export existing user data from your backend
2. Create a migration script to:
   - Create Firebase accounts for existing users
   - Send password reset emails to all users
   - Import user profiles to Firestore
3. Update all components to use `useFirebaseAuth` instead of `useAuth`
4. Remove old backend auth endpoints

## Testing

### Test User Registration
```bash
# Use the signup page or:
curl -X POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"test123","returnSecureToken":true}'
```

### Test Login
```bash
curl -X POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"test123","returnSecureToken":true}'
```

## Monitoring

1. Go to **Authentication** > **Users** to see all registered users
2. Check **Usage** tab for authentication metrics
3. Set up **Cloud Functions** for advanced monitoring (optional)

## Cost

Firebase Authentication is free for:
- Unlimited email/password authentication
- Unlimited Google Sign-In
- 50,000 phone authentications/month (if enabled)

## Support

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Console](https://console.firebase.google.com/)
- [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase)

## Files Created/Modified

### New Files:
- `src/config/firebase.ts` - Firebase initialization with Analytics
- `src/services/firebaseAuthService.ts` - Authentication service with Google Sign-In
- `src/contexts/FirebaseAuthContext.tsx` - React context for auth state
- `src/components/ProtectedRoute.tsx` - Route protection component
- `FIREBASE_AUTH_SETUP.md` - This documentation

### Modified Files:
- `.env.example` - Added Firebase configuration variables
- `package.json` - Added firebase dependency
- `src/pages/LoginPage.tsx` - Added Google Sign-In
- `src/pages/SignupPage.tsx` - Added Google Sign-In
- `src/components/Icon.tsx` - Added Google and loader icons
- `src/styles/n8n-auth.css` - Added Google button styles

## Next Steps

1. Set up Firebase project
2. Add configuration to `.env`
3. Update Login/Signup pages to use Firebase auth
4. Test all authentication flows
5. Deploy to production

## Date
February 21, 2026
