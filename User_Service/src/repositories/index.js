/**

Repository index - swap the concrete repository implementation here if you change DB.
The rest of the app imports repositories from this file.
*/
const userRepository = require('./mongo/userRepository');
const refreshTokenRepository = require('./mongo/refreshTokenRepository');

module.exports = {
userRepository,
refreshTokenRepository,
};
