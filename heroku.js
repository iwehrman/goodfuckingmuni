/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */

(function () {
    "use strict";

    var serf = require("serf/lib/launcher");

    var port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

    serf({
        open: false,
        children: 1,
        servers : [{
            port: port,
            ip: "0.0.0.0",
            name: "gfm",
            static: process.cwd()
        }]
    });
})();
