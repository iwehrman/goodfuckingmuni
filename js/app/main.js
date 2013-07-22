/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        astronomy = require("app/astronomy"),
        controller = require("app/controller"),
        view = require("app/view");
    
    require("jquery.event.move");
    require("jquery.event.swipe");

    var $html = $("html"),
        $head = $("head"),
        $body = $("body");
    
    function loadStylesheet() {
        var link;
        if (astronomy.isDaytime()) {
            link = "<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-light.min.css'>";
        } else {
            link = "<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-dark.min.css'>";
        }
        $head.append(link);
    }

    loadStylesheet();
    
    $(function () {
        controller.loadPageFromHash();
        
        $html.on("swiperight", function (e) {
            location.hash = $body.find("a.backnav").attr("href");
        }).on("movestart", function (e) {
            // If the movestart is heading off in an upwards or downwards
            // direction, prevent it so that the browser scrolls normally.
            if ((e.distX > e.distY && e.distX < -e.distY) ||
                    (e.distX < e.distY && e.distX > -e.distY)) {
                e.preventDefault();
            }
        });
    });
});
