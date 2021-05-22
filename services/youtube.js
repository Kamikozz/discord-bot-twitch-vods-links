// require('dotenv').config();

const { AuthService } = require('.');

const fetchList = () => {

};

class YoutubeService {
  static async authorizedRequest(func) {
    const isTokenValid = await AuthService.youtubeTokenValidation();
    if (isTokenValid) return func();
  }

  static list() {
    return this.authorizedRequest(fetchList);
  }
}

module.exports = YoutubeService;
