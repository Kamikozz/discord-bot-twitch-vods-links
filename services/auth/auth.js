// const store = require('../../store');
// const { error } = require('../../utils');
const YoutubeAuthService = require('./youtube-auth');
const { discord } = require('../../api');

class AuthService {
  // static authorizedRequest(func) {

  // }

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

  // static requestYoutubeAuthorization() {
  //   // store.youtube.accessToken = '';
  // //   try {
  // //     await this.refreshAccessToken();
  // //   } catch (e) {
  // //     error(e.message);
  // //     createAuthLink();
  // //   }
  //   if (YoutubeAuthService.isValidToken()) {
  //     YoutubeAuthService.requestAccessToken();
  //   } else {

  //   }
  // }
}

module.exports = AuthService;
