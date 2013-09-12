/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        Q = require("q"),
        astronomy = require("app/astronomy"),
        controller = require("app/controller"),
        view = require("app/view");
    
    require("jquery.event.move");
    require("jquery.event.swipe");

    var $html = $("html"),
        $head = $("head"),
        $body = $("body"),
        $loading = $body.find(".loading");

    var spinnerHtml = require("text!html/loading.html"),
        $spinner = $(spinnerHtml);
    
    $loading.append($spinner);
    
    function loadStylesheet() {
        var deferred = Q.defer(),
            url;
        
        if (astronomy.isDaytime()) {
            url = "css/topcoat-mobile-light.min.css";
        } else {
            url = "css/topcoat-mobile-dark.min.css";
        }
        
        var attributes = {
            type: "text/css",
            rel:  "stylesheet",
            href: url
        };
        
        $("<link/>")
            .attr(attributes)
            .load(deferred.resolve)
            .error(deferred.reject)
            .appendTo($head);
        
        return deferred.promise;
    }

    window.addEventListener("focus", function (event) {
        view.refreshPage(true); // force refresh
    });
    
    // hack to refresh the page on focus in Mobile Safari
    var lastTime = Date.now();
    (function getTime() {
        var newTime = Date.now();
        if (newTime - lastTime > 1000) {
            view.refreshPage(true);
        }
        lastTime = newTime;
        setTimeout(getTime, 500);
    }());

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

    loadStylesheet().done(function () {
        $(function () {
            controller.loadPageFromHash();
        });
    });
});
