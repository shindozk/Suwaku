const {YukufyClient} = require("./src/utils/Player");
const ffmpegManager = require("./src/utils/FFmpegManager");

module.exports = {
    YukufyClient,
    FFmpegManager: ffmpegManager
};

require("./src/scripts/Update");
//require("./test2");

//© 2025 Yukufy Player Music - Kandaraku Studios | Owner - Developer: shindozk