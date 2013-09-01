/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        mustache = require("mustache"),
        page = require("app/page");
    
    var _buttonHtml = require("text!html/button.html"),
        _containerHtml = require("text!html/list.html"),
        _entryHtml = require("text!html/entry.html");
        
    var buttonTemplate = mustache.compile(_buttonHtml),
        containerHtml = mustache.render(_containerHtml),
        entryTemplate = mustache.compile(_entryHtml);
        
    function makeEmptyListEntry(message, href) {
        var entrySettings = {
            left: "<span class=entry__empty>" + message + "</span>",
            href: href
        },  entryHTML = entryTemplate(entrySettings),
            $entry = $(entryHTML);
        
        return $entry;
    }
    
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
                    "class": "remove",
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
    
    function showList(title, listPromise, options) {
        options = options || {};
        
        var finishedLoading = false,
            $container = $(containerHtml);
        
        listPromise.done(function (list) {
            var $entries = $container.find(".entries");
            
            if (list && list.length > 0) {
                list.forEach(function (obj, index) {
                    var $entry = makeListEntry(obj, index, options);
                    $entry.css("opacity", "0.0");
                    $entries.append($entry);
                    $entry.animate({
                        opacity: 1.0
                    }, 100 + (20 * index));
                });
            } else if (options.emptyMessage) {
                var $entry = makeEmptyListEntry(options.emptyMessage, options.addHref);
                $entry.css("opacity", "0.0");
                $entries.append($entry);
                $entry.animate({
                    opacity: 1.0
                }, 100);
            }
        });
        
        page.showPage(title, $container, listPromise, options);
    }

    exports.showList = showList;
});
