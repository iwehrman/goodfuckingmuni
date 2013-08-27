/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache");

    var REFRESH_INTERVAL = 5000;
    
    var _backHtml = require("text!html/back.html"),
        _containerHtml = require("text!html/container.html"),
        _entryHtml = require("text!html/entry.html"),
        _buttonHtml = require("text!html/button.html");

    var backTemplate = mustache.compile(_backHtml),
        containerTemplate = mustache.compile(_containerHtml),
        entryTemplate = mustache.compile(_entryHtml),
        buttonTemplate = mustache.compile(_buttonHtml);

    var $body = $("body"),
        $content = $body.find(".content");
    
    var refreshTimer = null,
        handleRefresh;

    function makeListEntry(obj, index, opts) {
        var entrySettings = {
            href: opts.getEntryHref ? opts.getEntryHref(obj, index) : null,
            tags: opts.getTags ? opts.getTags(obj, index) : null,
            highlight: opts.getHighlight ? opts.getHighlight(obj, index) : null,
            left: opts.getLeft ? opts.getLeft(obj, index) : null,
            right: opts.getRight ? opts.getRight(obj, index) : null
        },  entryHTML = entryTemplate(entrySettings),
            $entry = $(entryHTML);

        if (opts.getRemoveHref) {
            var removeHref = opts.getRemoveHref(obj),
                removeSettings = {
                    "class": "entry__remove",
                    href: removeHref,
                    title: "&times;"
                },
                removeHtml = buttonTemplate(removeSettings),
                $remove = $(removeHtml),
                removeButton = $remove.children()[0];
            
            $entry.find(".entry__right").append($remove);
            $entry.on("swipeleft", function (event) {
                var $title = $entry.find(".entry__right .entry__title"),
                    $subtitle = $entry.find(".entry__right .entry__subtitle");
                
                $title.hide();
                $subtitle.hide();
                $remove.show();
                event.stopPropagation();
                event.preventDefault();
    
                // capture-phase event listener to cancel entry clicks during removal
                document.addEventListener("click", function listener(event) {
                    if (event.target === removeButton && opts.confirmRemove(obj)) {
                        $entry.remove();
                    } else {
                        $remove.hide();
                        $title.show();
                        $subtitle.show();
                        event.preventDefault();
                    }
                    document.removeEventListener("click", listener, true);
                    event.stopPropagation();
                }, true);
            });
        }
        
        return $entry;
    }
    
    function makeListContainer(title, opts) {
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
        
        var containerSettings = {
            left: left,
            center: title,
            right: right
        },  containerHTML = containerTemplate(containerSettings),
            $container = $(containerHTML);
            
        return $container;
    }

    function showList(title, listPromise, options) {
        options = options || {};
        
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
            refreshTimer = null;
            handleRefresh = null;
        }
        
        var $container = makeListContainer(title, options),
            $loading = $container.first(),
            $children = $content.children();
        
        if ($children.length === 1) {
            $children.replaceWith($container);
        } else {
            if ($children.length > 1) {
                $content.empty();
            }
            $content.append($container);
        }
        
        $loading.animate({
            opacity: 1.0
        }, 100);

        listPromise.done(function (list) {
            var $entries = $container.find(".entries");
            
            $loading.hide();

            list.forEach(function (obj, index) {
                var $entry = makeListEntry(obj, index, options);
                $entry.css("opacity", "0.0");
                $entries.append($entry);
                $entry.animate({
                    opacity: 1.0
                }, 100 + (20 * index));
            });
            
            if (options.refresh) {
                handleRefresh = options.refresh;
                refreshTimer = window.setInterval(handleRefresh, REFRESH_INTERVAL);
            }
            
            if (options.scroll) {
                var $entry = $content.find(".highlight").parents(".entry");
                $body.animate({
                    scrollTop: $entry.offset().top - $content.scrollTop()
                });
            } else {
                $body.animate({
                    scrollTop: 0
                });
            }
        });
    }
    
    function refreshList(force) {
        if (handleRefresh) {
            handleRefresh(force);
        }
    }

    exports.showList = showList;
    exports.refreshList = refreshList;
});
