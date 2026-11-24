/**
 * Firebase Authentication & Identity Manager for N.A.V.I.I.
 * Supports Google OAuth Sign-In and Email/Password Authentication.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDOrR5nlw3dW47_ErRzDczJCNkundwr3w4",
  authDomain: "naviixai-uk14.firebaseapp.com",
  projectId: "naviixai-uk14",
  storageBucket: "naviixai-uk14.firebasestorage.app",
  messagingSenderId: "241439983629",
  appId: "1:241439983629:web:9927e7900a691671cfed44",
  measurementId: "G-VSNSNYLF46"
};

const NaviiAuth = {
  currentUser: null,
  authToken: null,
  initialized: false,

  init() {
    if (typeof firebase === 'undefined') {
      console.warn('[N.A.V.I.I Auth] Firebase SDK not loaded, operating in offline mode.');
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.initialized = true;

      // Listen for auth state changes
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          this.authToken = await user.getIdToken();
          localStorage.setItem('navii_token', this.authToken);
          localStorage.setItem('navii_user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL
          }));
          this.updateUI(true);
        } else {
          this.currentUser = null;
          this.authToken = null;
          localStorage.removeItem('navii_token');
          localStorage.removeItem('navii_user');
          this.updateUI(false);
        }
      });
    } catch (err) {
      console.error('[N.A.V.I.I Auth] Initialization error:', err);
    }
  },

  async loginWithGoogle() {
    if (!this.initialized) throw new Error('Firebase Auth not initialized');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await firebase.auth().signInWithPopup(provider);
  },

  async loginWithEmail(email, password) {
    if (!this.initialized) throw new Error('Firebase Auth not initialized');
    return await firebase.auth().signInWithEmailAndPassword(email, password);
  },

  async registerWithEmail(email, password, displayName = '') {
    if (!this.initialized) throw new Error('Firebase Auth not initialized');
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    if (displayName && cred.user) {
      await cred.user.updateProfile({ displayName });
    }
    return cred;
  },

  async logout() {
    if (!this.initialized) return;
    await firebase.auth().signOut();
  },

  async getToken() {
    if (this.currentUser) {
      this.authToken = await this.currentUser.getIdToken(true);
      return this.authToken;
    }
    return localStorage.getItem('navii_token') || null;
  },

  updateUI(isAuthenticated) {
    const userBadgeName = document.querySelector('.user-details .user-name');
    const userAvatar = document.querySelector('.user-avatar');
    const userStatus = document.querySelector('.user-details .user-status');
    const modalLoggedOut = document.getElementById('auth-view-logged-out');
    const modalLoggedIn = document.getElementById('auth-view-logged-in');

    if (isAuthenticated && this.currentUser) {
      const name = this.currentUser.displayName || this.currentUser.email.split('@')[0];
      const initials = name.slice(0, 2).toUpperCase();

      if (userBadgeName) userBadgeName.textContent = name;
      if (userStatus) userStatus.innerHTML = '<span class="status-indicator active"></span> Neural Core Active';
      if (userAvatar) {
        if (this.currentUser.photoURL) {
          userAvatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="${name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
          userAvatar.textContent = initials;
        }
      }

      // Update Modal
      if (modalLoggedOut) modalLoggedOut.style.display = 'none';
      if (modalLoggedIn) {
        modalLoggedIn.style.display = 'block';
        const profileEmail = document.getElementById('auth-profile-email');
        const profileName = document.getElementById('auth-profile-name');
        const profileAvatar = document.getElementById('auth-profile-avatar');
        if (profileEmail) profileEmail.textContent = this.currentUser.email;
        if (profileName) profileName.textContent = name;
        if (profileAvatar) {
          if (this.currentUser.photoURL) {
            profileAvatar.innerHTML = `<img src="${this.currentUser.photoURL}" style="width: 48px; height: 48px; border-radius: 50%;">`;
          } else {
            profileAvatar.textContent = initials;
          }
        }
      }
    } else {
      if (userBadgeName) userBadgeName.textContent = 'Guest Operator';
      if (userStatus) userStatus.innerHTML = '<span class="status-indicator"></span> Standby (Click to Sign In)';
      if (userAvatar) userAvatar.textContent = 'OP';

      if (modalLoggedOut) modalLoggedOut.style.display = 'block';
      if (modalLoggedIn) modalLoggedIn.style.display = 'none';
    }
  }
};

window.NaviiAuth = NaviiAuth;
