const YoutubeAuthService = require('./youtube-auth');
const { discord } = require('../../api');

class AuthService {
  static requestYoutubeAuthorization() {
    const authLink = YoutubeAuthService.createAuthLink();
    discord.createMessage({ message: authLink });
  }

  static youtubeTokenValidation() {
    if (YoutubeAuthService.isValidToken()) return true;
    if (YoutubeAuthService.hasRefreshToken()) {
      return YoutubeAuthService.refreshAccessToken();
    }
    this.requestYoutubeAuthorization();
    return false;
  }
}

module.exports = AuthService;
