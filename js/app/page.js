/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        mustache = require("mustache");

    var REFRESH_INTERVAL = 5000;
    
    var _backHtml = require("text!html/back.html"),
        _headerHtml = require("text!html/header.html"),
        _buttonHtml = require("text!html/button.html");
    
    var backTemplate = mustache.compile(_backHtml),
        headerTemplate = mustache.compile(_headerHtml),
        buttonTemplate = mustache.compile(_buttonHtml);
    
    var $body = $("body"),
        $content = $body.find(".content"),
        $loading = $body.find(".loading");
    
    var refreshTimer = null,
        refreshInProgress = false,
        handleRefresh;
           
    function refreshPage(force) {
        window.clearTimeout(refreshTimer);
        
        if (handleRefresh && !refreshInProgress) {
            refreshInProgress = true;
            handleRefresh(force).done(function () {
                refreshTimer = window.setTimeout(refreshPage, REFRESH_INTERVAL);
            }).always(function () {
                refreshInProgress = false;
            });

        }
    }
    
    function makeHeader(title, opts) {
        var left;
        if (opts.backHref) {
            var backSettings = {
                title: "&lsaquo;",
                href: opts.backHref
            };
            left = backTemplate(backSettings);
        } else {
            left = null;
        }
        
        var right;
        if (opts.addHref) {
            var addSettings = {
                title: "+",
                href: opts.addHref
            };
            right = buttonTemplate(addSettings);
        } else {
            right = null;
        }
        
        var headerSettings = {
            left: left,
            center: title,
            right: right
        },  headerHTML = headerTemplate(headerSettings),
            $header = $(headerHTML);
            
        return $header;
    }

    function showPage(title, $container, loadPromise, options) {
        if (options === undefined) {
            options = {};
        }
        
        var finishedLoading = false,
            $header = makeHeader(title, options);
        
        window.clearInterval(refreshTimer);
        refreshTimer = null;
        refreshInProgress = false;
        handleRefresh = null;
        
        $content.empty();
        $content.append($header);
        $content.append($container);
        
        loadPromise.always(function () {
            finishedLoading = true;
            $loading.stop().fadeOut();
            
            if (options.refresh) {
                handleRefresh = function (force) {
                    return options.refresh(force, $container);
                };
                refreshTimer = window.setTimeout(refreshPage, REFRESH_INTERVAL);
            }
            
            if (options.scroll) {
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

    exports.showPage = showPage;
    exports.refreshPage = refreshPage;
});
