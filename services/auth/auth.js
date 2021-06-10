const YoutubeAuthService = require('./youtube-auth');
const { discord } = require('../../api');

class AuthService {
  static requestYoutubeAuthorization() {
    const authLink = YoutubeAuthService.createAuthLink();
    discord.createMessage({ message: authLink });
  }

  static async youtubeTokenValidation() {
    if (YoutubeAuthService.isValidToken()) return true;
    if (YoutubeAuthService.hasRefreshToken()) {
      const isTokenRefreshed = await YoutubeAuthService.refreshAccessToken();
      if (isTokenRefreshed) return true;
    }
    this.requestYoutubeAuthorization();
    return false;
  }
}

module.exports = AuthService;
