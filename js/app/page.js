/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery");

    var REFRESH_INTERVAL = 5000;
    
    var $body = $("body"),
        $content = $body.find(".content"),
        $loading = $body.find(".loading");
    
    var refreshTimer = null,
        handleRefresh;

    function showPage($header, $container, loadPromise, refresh, scroll) {
        var finishedLoading = false;
        
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
            refreshTimer = null;
            handleRefresh = null;
        }
        
        $content.empty();
        $content.append($header);
        $content.append($container);
        
        loadPromise.always(function () {
            finishedLoading = true;
            $loading.stop().fadeOut();
            
            if (refresh) {
                handleRefresh = refresh;
                refreshTimer = window.setInterval(handleRefresh, REFRESH_INTERVAL);
            }
            
            if (scroll) {
                var $elem = $container.find(".highlight");
                $body.animate({
                    scrollTop: $elem.offset().top - $container.scrollTop()
                });
            } else {
                $body.animate({
                    scrollTop: 0
                });
            }
        });
        
        setTimeout(function () {
            if (!finishedLoading) {
                $loading.fadeIn();
            }
        }, 25);
    }
       
    function refreshPage(force) {
        if (handleRefresh) {
            handleRefresh(force);
        }
    }

    exports.showPage = showPage;
    exports.refreshPage = refreshPage;
});
